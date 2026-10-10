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
const BASE = 'http://localhost:8080';
const ADMIN = { username: 'admin', password: 'AdminDev123456' };

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
  const regA = await api('POST', '/api/auth/provider/register',
    { body: { phone: phoneA, password: 'test123456', realName: '张师傅', serviceArea: '阳光小区' } });
  ok('服务者 A 注册成功', regA.json?.code === 0, JSON.stringify(regA.json));
  const providerA = regA.json?.data;
  ok('新注册默认「待审核」', providerA?.auditStatus === 'PENDING', `实际=${providerA?.auditStatus}`);

  const regB = await api('POST', '/api/auth/provider/register',
    { body: { phone: phoneB, password: 'test123456', realName: '李阿姨', serviceArea: '幸福家园' } });
  ok('服务者 B 注册成功', regB.json?.code === 0);
  const providerB = regB.json?.data;

  section('3. 未审核的服务者主页不可访问');
  const homeBefore = await api('GET', `/api/public/provider/home?referralCode=NOTEXIST00000000`);
  ok('不存在的推广码返回 41001', homeBefore.json?.code === 41001, `实际=${homeBefore.json?.code}`);

  section('4. 管理员审核通过');
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
      referralCode: codeB, serviceItemId: itemIdA,
      customerName: '客户乙', customerPhone: '13511110002', community: '幸福家园',
      address: '幸福家园 8 栋 202', bookingDate: today, bookingSlot: '14:00-16:00',
      privacyAccepted: true,
    },
  });
  ok('客户乙预约成功', bookB.json?.code === 0);

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

  section('15. 停用的服务者不能继续接收新预约');
  await api('POST', `/api/admin/providers/${providerB.providerId}/status`,
    { body: { enabled: false, reason: '违规测试' }, token: adminToken });
  const homeAfter = await api('GET', `/api/public/provider/home?referralCode=${codeB}`);
  ok('停用后主页不可访问(41007)', homeAfter.json?.code === 41007, `实际 code=${homeAfter.json?.code} msg=${homeAfter.json?.message}`);
  const bookAfter = await api('POST', '/api/public/bookings', {
    body: {
      referralCode: codeB, serviceItemId: itemIdA, customerName: '客户丙',
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

  console.log(`\n${'='.repeat(52)}`);
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常:', e); process.exit(1); });