/**
 * 构建前守卫：确认 dist 目录可被清理。
 *
 * ── 为什么必须有这一步 ────────────────────────────────────────────
 * 真实故障：微信开发者工具 + `npm run dev:weapp`（taro --watch）同时开着，
 * 它们会一直持有 miniapp/dist 目录：
 *   - taro watch 进程在监听源码，改一个字就往 dist 里写一份 **dev 产物**
 *     （走 config/dev.ts）
 *   - 微信开发者工具的 wxfilewatcher_x64.exe 也持有该目录
 * 此时执行 `npm run build:weapp`，Taro 想清空 dist 却删不掉（Windows 上
 * 被占用的目录删不掉），于是**跳过清理、在旧产物上增量写**：
 *   dev 产物 + prod 产物混在同一个 dist 里 → 上传后部分页面白屏。
 *
 * 症状极其难定位：本地开发者工具里看着正常、后端接口全通，
 * 只有真机/体验版上某一个页面莫名其妙空白。
 *
 * 这个脚本在构建前先试着清空 dist，删不掉就**直接失败并告诉你是谁占着**，
 * 而不是让人拿着一个混了两种配置的产物去发版。
 */
const fs = require('fs')
const path = require('path')

// 可用 NB_DIST_DIR 覆盖（自测失败分支时指向一个删不掉的目录）
const DIST = process.env.NB_DIST_DIR
  ? path.resolve(process.env.NB_DIST_DIR)
  : path.resolve(__dirname, '..', 'miniapp', 'dist')

function fail(msg, detail) {
  console.error(`\n  [阻塞] ${msg}\n`)
  if (detail) console.error(detail, '\n')
  console.error('  处理办法：')
  console.error('    1. 关掉微信开发者工具（主窗口要关掉，最小化不释放句柄）')
  console.error('    2. 关掉还在跑的 watch：Ctrl+C 掉 `npm run dev:weapp`')
  console.error('    3. 再跑一次 npm run build:weapp')
  console.error('')
  console.error('  ⚠️ 绝不能带着 dev 产物去发版 —— 那是本次线上白屏的直接原因。')
  console.error('')
  process.exit(1)
}

if (!fs.existsSync(DIST)) {
  // 首次构建，没有 dist 很正常
  process.exit(0)
}

try {
  // 先改名再删除：改名失败同样说明被占用
  const tmp = DIST + '.stale'
  fs.renameSync(DIST, tmp)
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exit(0)
} catch (e) {
  fail('miniapp/dist 被别的进程占用，无法清空', `  原因: ${e.message}\n  目录: ${DIST}`)
}