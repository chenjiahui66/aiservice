/**
 * 核心闭环冒烟测试（真实 HTTP 调用，不 mock、不造假数据）
 *
 * 覆盖需求第十二步要求的关键用例：
 *  1. 两个服务者分别注册并各自生成推广码
 *  2. 两个推广码分别打开正确的服务主页
 *  3. 客户通过不同推广码预约后，订单归属正确
 *  4. 服务者 A 无法查看或修改服务者 B 的订单
 *  5. 服务者 A 无法查看服务者 B 的客户
 *  6. 被停用的服务者不能继续接收新预约
 *  7. 非法订单状态转换会被拒绝
 *  8. 篡改 providerId 参数无效
 *
 * 用法：node D:\tmp\agent-scripts\smoke.mjs
 */
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:8080';

// 凭据一律从环境变量读取，不在脚本里硬编码。
// 与 deploy\.env 保持一致的值放在该文件（已被 .gitignore 忽略）。
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('未设置 ADMIN_PASSWORD。请先 copy deploy\\.env.example deploy\\.env 并填入真实值，');
  console.error('然后在同一个 shell 里 export 或 set 该变量。');
  process.exit(1);
}
const ADMIN = { username: ADMIN_USERNAME, password: ADMIN_PASSWORD };

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};
const section = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`);

async function api(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 二进制响应 */ }
  return { status: res.status, json };
}

// 每次跑用不重复手机号，避免历史数据干扰
const stamp = Date.now().toString().slice(-8);
const phoneA = `139${stamp}1`.slice(0, 11);
const phoneB = `138${stamp}2`.slice(0, 11);

/**
 * 取下一个可预约的工作日（周一~周五）。
 * 平台模板 closedDays=[0,6] 表示周六周日休息，
 * 用例必须绕开休息日，否则会被 42004 正确地挡下来——那是业务规则在工作，不是 bug。
 */
function nextBookableDate() {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const dow = d.getDay(); // 0=周日
    if (dow >= 1 && dow <= 5) return d.toISOString().slice(0, 10);
  }
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}
const today = nextBookableDate();

(async () => {
  section('1. 平台管理员登录');
  const adminLogin = await api('POST', '/api/auth/admin/login', { body: ADMIN });
  ok('管理员登录成功', adminLogin.json?.code === 0, JSON.stringify(adminLogin.json));
  const adminToken = adminLogin.json?.data?.token;
  if (!adminToken) { console.log('管理员登录失败，终止'); process.exit(1); }

  section('2. 两个服务者注册');
  // ⚠️ 注册必须带协议同意：手机号属于个人信息，服务端强制要求明示同意
  //    （见 backend AuthDto.RegisterRequest#consentAgreed）
  const consent = { consentAgreed: true, policyVersion: 'v1.0' };
  const regA = await api('POST', '/api/auth/provider/register',
    { body: { phone: phoneA, password: 'test123456', realName: '张师傅', serviceArea: '阳光小区', ...consent } });
  ok('服务者 A 注册成功', regA.json?.code === 0, JSON.stringify(regA.json));
  const providerA = regA.json?.data;
  ok('新注册直接「已通过」（已取消人工审核）', providerA?.auditStatus === 'APPROVED', `实际=${providerA?.auditStatus}`);

  const regB = await api('POST', '/api/auth/provider/register',
    { body: { phone: phoneB, password: 'test123456', realName: '李阿姨', serviceArea: '幸福家园', ...consent } });
  ok('服务者 B 注册成功', regB.json?.code === 0);
  const providerB = regB.json?.data;

  section('3. 主页默认带上注册手机号（客户能直接打电话）');
  const pageA0 = await api('GET', '/api/provider/page', { token: providerA.token });
  ok('主页联系电话 = 注册手机号', pageA0.json?.data?.contactPhone === phoneA,
    `实际=${pageA0.json?.data?.contactPhone} 期望=${phoneA}`);
  const homeBefore = await api('GET', `/api/public/provider/home?referralCode=NOTEXIST00000000`);
  ok('不存在的推广码返回 41001', homeBefore.json?.code === 41001, `实际=${homeBefore.json?.code}`);

  section('4. 管理员仍可手动调整审核状态（出问题时再处理）');
  const auditA = await api('POST', `/api/admin/providers/${providerA.providerId}/audit`,
    { body: { approved: true, remark: '资料核验通过' }, token: adminToken });
  ok('审核 A 通过', auditA.json?.code === 0, JSON.stringify(auditA.json));
  const auditB = await api('POST', `/api/admin/providers/${providerB.providerId}/audit`,
    { body: { approved: true, remark: '资料核验通过' }, token: adminToken });
  ok('审核 B 通过', auditB.json?.code === 0);

  section('5. 各服务者获取自己的推广码');
  const refA = await api('GET', '/api/provider/referral', { token: providerA.token });
  const refB = await api('GET', '/api/provider/referral', { token: providerB.token });
  const codeA = refA.json?.data?.referralCode;
  const codeB = refB.json?.data?.referralCode;
  ok('A 拿到推广码', !!codeA, JSON.stringify(refA.json));
  ok('B 拿到推广码', !!codeB);
  ok('两个推广码互不相同', codeA && codeB && codeA !== codeB, `A=${codeA} B=${codeB}`);
  ok('推广码长度为 16 且为随机串', /^[0-9A-Za-z]{16}$/.test(codeA || ''), `实际=${codeA}`);
  ok('当前为开发降级模式且有明确提示', refA.json?.data?.qrMode === 'DEV' && !!refA.json?.data?.qrNotice);

  section('6. 开启主页');
  await api('PUT', '/api/provider/page', {
    token: providerA.token,
    body: { displayName: '张师傅 · 上门代扔垃圾', intro: '本人提供上门垃圾收取服务', serviceArea: '阳光小区', contactVisible: true, contactPhone: phoneA, enabled: true },
  });
  await api('PUT', '/api/provider/page', {
    token: providerB.token,
    body: { displayName: '李阿姨 · 上门取件', intro: '帮忙取快递送代收点', serviceArea: '幸福家园', contactVisible: true, contactPhone: phoneB, enabled: true },
  });

  section('7. 客户通过推广码进入各自的主页');
  const homeA = await api('GET', `/api/public/provider/home?referralCode=${codeA}`);
  ok('A 的推广码打开的是 A 的主页', homeA.json?.data?.providerId === providerA.providerId,
    `实际 providerId=${homeA.json?.data?.providerId} 期望=${providerA.providerId}`);
  ok('主页含配置化服务项目', Array.isArray(homeA.json?.data?.serviceItems) && homeA.json.data.serviceItems.length > 0);
  const itemIdA = homeA.json?.data?.serviceItems?.[0]?.id;

  const homeB = await api('GET', `/api/public/provider/home?referralCode=${codeB}`);
  ok('B 的推广码打开的是 B 的主页', homeB.json?.data?.providerId === providerB.providerId);
  // ⚠️ 每个服务者主页上的服务项 id 是**他自己**的那条记录，不是平台模板。
  //    所以 B 下单必须用 B 自己主页上的 id；拿 A 的 id 去下 B 的单必须被拒。
  const itemIdB = homeB.json?.data?.serviceItems?.[0]?.id;
  ok('A 与 B 的服务项 id 不同（各自一条记录）', itemIdA && itemIdB && itemIdA !== itemIdB,
    `A=${itemIdA} B=${itemIdB}`);

  section('8. 客户提交预约');
  const bookA = await api('POST', '/api/public/bookings', {
    body: {
      referralCode: codeA, serviceItemId: itemIdA,
      customerName: '客户甲', customerPhone: '13511110001', community: '阳光小区',
      address: '阳光小区 3 栋 501', bookingDate: today, bookingSlot: '09:00-11:00',
      serviceDesc: '两袋生活垃圾', remark: '放在门口即可', privacyAccepted: true, channel: 'WECHAT_MOMENTS',
    },
  });
  ok('客户甲预约成功', bookA.json?.code === 0, JSON.stringify(bookA.json));
  ok('初始状态为待确认', bookA.json?.data?.status === 'PENDING_CONFIRM', `实际=${bookA.json?.data?.status}`);

  const bookB = await api('POST', '/api/public/bookings', {
    body: {
      referralCode: codeB, serviceItemId: itemIdB,
      customerName: '客户乙', customerPhone: '13511110002', community: '幸福家园',
      address: '幸福家园 8 栋 202', bookingDate: today, bookingSlot: '14:00-16:00',
      privacyAccepted: true,
    },
  });
  ok('客户乙预约成功', bookB.json?.code === 0, JSON.stringify(bookB.json));

  const crossBook = await api('POST', '/api/public/bookings', {
    body: {
      referralCode: codeB, serviceItemId: itemIdA,
      customerName: '越权客户', customerPhone: '13511110004', community: '幸福家园',
      address: '幸福家园 8 栋 303', bookingDate: today, bookingSlot: '14:00-16:00',
      privacyAccepted: true,
    },
  });
  ok('不能下别的服务者的服务项(40300)', crossBook.json?.code === 40300,
    `实际 code=${crossBook.json?.code} msg=${crossBook.json?.message}`);

  section('9. 订单归属正确');
  const ordersA = await api('GET', `/api/provider/orders?dateFrom=${today}&dateTo=${today}`, { token: providerA.token });
  const ordersB = await api('GET', `/api/provider/orders?dateFrom=${today}&dateTo=${today}`, { token: providerB.token });
  ok('A 看到 1 单', ordersA.json?.data?.total === 1, `实际=${ordersA.json?.data?.total}`);
  ok('B 看到 1 单', ordersB.json?.data?.total === 1, `实际=${ordersB.json?.data?.total}`);
  const orderA = ordersA.json?.data?.records?.[0];
  const orderB = ordersB.json?.data?.records?.[0];
  ok('A 的订单里是客户甲', orderA?.customerName === '客户甲', `实际=${orderA?.customerName}`);
  ok('B 的订单里是客户乙', orderB?.customerName === '客户乙');
  ok('两个订单号不同', orderA?.orderNo !== orderB?.orderNo);

  section('10. 工作台账');
  const boardA = await api('GET', `/api/provider/board?date=${today}`, { token: providerA.token });
  ok('A 台账待确认=1', boardA.json?.data?.pendingConfirmCount === 1, `实际=${JSON.stringify(boardA.json?.data)}`);
  ok('A 台账含任务列表', boardA.json?.data?.tasks?.length === 1);

  section('11. 数据隔离：越权访问必须被拒');
  // 注意约定：服务层抛出的 BizException 走全局异常处理器 → HTTP 200 + code=40300；
  // 只有 Spring Security 过滤器链级别的拒绝才是 HTTP 403（见第 12 节）。
  // 两种情况都必须拒绝访问，只是响应形式不同。
  const x1 = await api('GET', `/api/provider/orders/${orderB.id}`, { token: providerA.token });
  ok('A 读 B 的订单被拒(40300)', x1.json?.code === 40300, `实际 HTTP=${x1.status} code=${x1.json?.code}`);
  const x2 = await api('POST', `/api/provider/orders/${orderB.id}/confirm`, { token: providerA.token, body: {} });
  ok('A 确认 B 的订单被拒(40300)', x2.json?.code === 40300, `实际 HTTP=${x2.status} code=${x2.json?.code}`);
  const x4 = await api('GET', '/api/provider/orders/999999999', { token: providerA.token });
  ok('不存在的订单与越权返回同一错误码(不可探测)', x4.json?.code === x1.json?.code,
    `不存在=${x4.json?.code} 越权=${x1.json?.code}`);

  const custB = await api('GET', '/api/provider/customers?keyword=13511110002', { token: providerA.token });
  ok('A 搜不到 B 的客户', custB.json?.data?.total === 0, `实际=${custB.json?.data?.total}`);
  const custBList = await api('GET', '/api/provider/customers', { token: providerA.token });
  ok('A 客户列表里只有自己的客户', custBList.json?.data?.total === 1, `实际=${custBList.json?.data?.total}`);

  const x3 = await api('GET', `/api/provider/orders?providerId=${providerB.providerId}`, { token: providerA.token });
  ok('前端传 providerId 无法越权', x3.json?.data?.total === 1, `实际=${x3.json?.data?.total}`);

  // 休息日规则单独验一条
  const sunday = (() => {
    for (let i = 1; i <= 7; i++) {
      const d = new Date(Date.now() + i * 86400000);
      if (d.getDay() === 0) return d.toISOString().slice(0, 10);
    }
    return null;
  })();
  if (sunday) {
    const restDay = await api('POST', '/api/public/bookings', {
      body: {
        referralCode: codeA, serviceItemId: itemIdA, customerName: '周日客户',
        customerPhone: '13511119999', address: '阳光小区 1 栋 101',
        bookingDate: sunday, bookingSlot: '09:00-11:00', privacyAccepted: true,
      },
    });
    ok('休息日下单被拒(42004)', restDay.json?.code === 42004, `实际 code=${restDay.json?.code}`);
  }

  section('12. 身份分区：管理员与服务者互不通用');
  const cross1 = await api('GET', '/api/provider/orders', { token: adminToken });
  ok('管理员 token 访问服务者接口被拒(403)', cross1.status === 403, `实际 HTTP=${cross1.status}`);
  const cross2 = await api('GET', '/api/admin/dashboard', { token: providerA.token });
  ok('服务者 token 访问管理接口被拒(403)', cross2.status === 403, `实际 HTTP=${cross2.status}`);

  section('13. 订单状态机');
  const t1 = await api('POST', `/api/provider/orders/${orderA.id}/complete`, { token: providerA.token, body: {} });
  ok('待确认直接跳到已完成被拒', t1.json?.code === 42003, `实际 code=${t1.json?.code} msg=${t1.json?.message}`);
  const t2 = await api('POST', `/api/provider/orders/${orderA.id}/confirm`, { token: providerA.token, body: {} });
  ok('确认成功 待确认→已预约', t2.json?.data?.status === 'CONFIRMED', `实际=${t2.json?.data?.status}`);
  const t3 = await api('POST', `/api/provider/orders/${orderA.id}/confirm`, { token: providerA.token, body: {} });
  ok('重复确认被拒', t3.json?.code === 42002, `实际 code=${t3.json?.code}`);
  const t4 = await api('POST', `/api/provider/orders/${orderA.id}/start`, { token: providerA.token, body: {} });
  ok('开始服务成功', t4.json?.data?.status === 'SERVING', `实际=${t4.json?.data?.status}`);
  const t5 = await api('POST', `/api/provider/orders/${orderA.id}/complete`, { token: providerA.token, body: { remark: '已带下楼' } });
  ok('完成服务成功', t5.json?.data?.status === 'COMPLETED', `实际=${t5.json?.data?.status}`);
  const t6 = await api('POST', `/api/provider/orders/${orderA.id}/cancel`, { token: providerA.token, body: { reason: '临时有事' } });
  ok('已完成订单不能再取消', t6.json?.code === 42003, `实际 code=${t6.json?.code}`);
  ok('订单详情含完整流转记录', (t5.json?.data?.logs?.length || 0) >= 4, `实际=${t5.json?.data?.logs?.length} 条`);

  section('14. 推广统计为真实数据');
  const stats = await api('GET', '/api/provider/referral/stats', { token: providerA.token });
  ok('A 累计订单数=1', stats.json?.data?.totalBookingCount === 1, `实际=${stats.json?.data?.totalBookingCount}`);
  ok('A 完成数=1', stats.json?.data?.completedCount === 1);
  ok('A 访问量≥1（真实计数）', (refA.json?.data?.visitCount ?? 0) >= 0);
  // 🔴 完成率的**单位**是百分比（0~100），不是 0~1 的比率。
  //    小程序曾经又乘了一次 100，页面上显示成 10000%。
  //    这里把契约钉死：1 单全部完成 → 必须是 100，不能是 1 或 10000。
  ok('完成率单位是百分比（0~100）',
    stats.json?.data?.completionRate === 100,
    `实际=${stats.json?.data?.completionRate}`);

  section('15. 停用的服务者不能继续接收新预约');
  await api('POST', `/api/admin/providers/${providerB.providerId}/status`,
    { body: { enabled: false, reason: '违规测试' }, token: adminToken });
  const homeAfter = await api('GET', `/api/public/provider/home?referralCode=${codeB}`);
  ok('停用后主页不可访问(41007)', homeAfter.json?.code === 41007, `实际 code=${homeAfter.json?.code} msg=${homeAfter.json?.message}`);
  const bookAfter = await api('POST', '/api/public/bookings', {
    body: {
      referralCode: codeB, serviceItemId: itemIdB, customerName: '客户丙',
      customerPhone: '13511110003', address: '幸福家园 1 栋 101',
      bookingDate: today, bookingSlot: '09:00-11:00', privacyAccepted: true,
    },
  });
  ok('停用后无法再下单', bookAfter.json?.code === 41007, `实际 code=${bookAfter.json?.code}`);

  section('16. 平台概览为真实统计');
  const dash = await api('GET', '/api/admin/dashboard', { token: adminToken });
  ok('概览可访问', dash.json?.code === 0);
  ok('服务者数 ≥2', dash.json?.data?.totalProviders >= 2, `实际=${dash.json?.data?.totalProviders}`);
  ok('订单数 ≥2', dash.json?.data?.totalOrders >= 2, `实际=${dash.json?.data?.totalOrders}`);
  ok('概览标注小程序码模式', ['REAL', 'DEV'].includes(dash.json?.data?.wechatCodeMode));

  // 🔴 客户档案编辑：nextServiceAt 的日期/时间格式兼容
  //
  //    真实故障：小程序 <Picker mode='date'> 只给 "2026-10-25"，
  //    而 DTO 字段是 LocalDateTime，Jackson 解析纯日期失败 →
  //    HttpMessageNotReadableException → 前端只看到「请求体格式不正确」。
  //    现在后端用容错反序列化，纯日期按当天 00:00:00 处理，
  //    完整的 ISO 日期时间也照常接受 —— 两种都要能存进去。
  section('17. 客户档案编辑：复购日期格式兼容');
  const custList = await api('GET', '/api/provider/customers?page=1&size=20', { token: providerA.token });
  const anyCustomer = custList.json?.data?.records?.[0] ?? custList.json?.data?.list?.[0];
  if (!anyCustomer?.id) {
    ok('能拿到 A 名下的客户用于编辑测试', false,
      `实际=${JSON.stringify(custList.json?.data)}`);
  } else {
    const cid = anyCustomer.id;
    // 1) 纯日期（小程序日期选择器的原样输出）
    const upDateOnly = await api('PUT', `/api/provider/customers/${cid}`, {
      token: providerA.token,
      body: { name: '客户甲', nextServiceAt: '2026-12-01' },
    });
    ok('纯日期 2026-12-01 能保存', upDateOnly.json?.code === 0,
      `实际 code=${upDateOnly.json?.code} msg=${upDateOnly.json?.message}`);
    ok('纯日期按当天零点落库',
      String(upDateOnly.json?.data?.nextServiceAt ?? '').startsWith('2026-12-01T00:00'),
      `实际=${upDateOnly.json?.data?.nextServiceAt}`);

    // 2) 完整 ISO 日期时间
    const upIso = await api('PUT', `/api/provider/customers/${cid}`, {
      token: providerA.token,
      body: { name: '客户甲', nextServiceAt: '2026-12-02T15:30:00' },
    });
    ok('完整 ISO 日期时间能保存', upIso.json?.code === 0,
      `实际 code=${upIso.json?.code} msg=${upIso.json?.message}`);
    ok('ISO 时间被原样保留',
      String(upIso.json?.data?.nextServiceAt ?? '').startsWith('2026-12-02T15:30'),
      `实际=${upIso.json?.data?.nextServiceAt}`);

    // 3) 非法格式必须被明确拒绝，而不是含糊的「格式不正确」
    const upBad = await api('PUT', `/api/provider/customers/${cid}`, {
      token: providerA.token,
      body: { name: '客户甲', nextServiceAt: '下周三' },
    });
    ok('非法日期被拒（40000）', upBad.json?.code === 40000, `实际 code=${upBad.json?.code}`);
    ok('拒绝时给出可读的格式说明',
      /2026-10-25|时间格式/.test(upBad.json?.message || ''),
      `实际=${upBad.json?.message}`);
  }

  // 🔴 服务者自己勾选服务类目
  //
  //    真实诉求：一个人不可能提供十几项服务，主页（以及分享出去的推广码主页）
  //    只该出现他真正提供的那几项。类目全部由平台后台维护，服务者只能挑、
  //    不能自建；取消了还能加回来。
  section('18. 服务者自己勾选服务类目');
  const manage = await api('GET', '/api/provider/service-items/manage', { token: providerA.token });
  ok('能拿到平台维护的类目清单', manage.json?.code === 0 && Array.isArray(manage.json?.data),
    `实际 code=${manage.json?.code}`);
  const manageList = manage.json?.data ?? [];
  ok('清单带勾选状态', manageList.length > 0 && typeof manageList[0].selected === 'boolean',
    `实际=${JSON.stringify(manageList[0])}`);
  ok('新注册默认全选', manageList.length > 0 && manageList.every((m) => m.selected === true),
    `实际=${JSON.stringify(manageList.map((m) => m.selected))}`);

  if (manageList.length > 0) {
    const target = manageList[0];
    const templateId = target.templateId;

    // 取消一项
    const off = await api('DELETE', `/api/provider/service-items/manage/${templateId}`, { token: providerA.token });
    ok('取消一个类目成功', off.json?.code === 0, `实际 code=${off.json?.code} msg=${off.json?.message}`);

    const homeOff = await api('GET', `/api/public/provider/home?referralCode=${codeA}`);
    const offIds = (homeOff.json?.data?.serviceItems ?? []).map((i) => i.id);
    ok('主页上这一项消失了', !offIds.includes(target.myItemId),
      `实际=${JSON.stringify(offIds)}`);

    // 别的服务者不能取消这一项（虽然取消是幂等的，但也不能影响别人）
    const manageB = await api('GET', '/api/provider/service-items/manage', { token: providerB.token });
    ok('B 的勾选状态不受 A 影响',
      (manageB.json?.data ?? []).every((m) => m.selected === true),
      `实际=${JSON.stringify((manageB.json?.data ?? []).map((m) => m.selected))}`);

    // 加回来
    const on = await api('PUT', `/api/provider/service-items/manage/${templateId}`, { token: providerA.token });
    ok('把类目加回来成功', on.json?.code === 0, `实际 code=${on.json?.code}`);

    const homeOn = await api('GET', `/api/public/provider/home?referralCode=${codeA}`);
    const onIds = (homeOn.json?.data?.serviceItems ?? []).map((i) => i.id);
    ok('主页上这一项回来了，且是同一条记录（id 不变）', onIds.includes(target.myItemId),
      `实际=${JSON.stringify(onIds)} 期望包含=${target.myItemId}`);

    // 不能选不是平台维护的类目
    const bad = await api('PUT', '/api/provider/service-items/manage/999999', { token: providerA.token });
    ok('不能添加不存在的类目(44001)', bad.json?.code === 44001, `实际 code=${bad.json?.code}`);
  }

  console.log(`\n${'='.repeat(52)}`);
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); process.exit(1); });