<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchDashboard } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import TrendChart from '@/components/TrendChart.vue'
import { ORDER_STATUS_LABEL } from '@/constants/dict'
import type { DashboardVO, OrderStatus } from '@/types/admin'

const router = useRouter()

const loading = ref(false)
const error = ref<string | null>(null)
const data = ref<DashboardVO | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    data.value = await fetchDashboard()
  } catch {
    data.value = null
    error.value = '平台概览加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const stats = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: '服务者总数', value: d.totalProviders, to: '/providers' },
    { label: '平台订单总数', value: d.totalOrders, to: '/orders' },
    { label: '客户总数', value: d.totalCustomers, to: undefined },
    { label: '待处理投诉', value: d.pendingComplaints, to: '/complaints' }
  ]
})

/**
 * 订单状态分布。后端 DashboardVO 未下发「已预约」独立计数字段，
 * 这里只列接口确实提供的计数，不补零、不推算。
 */
const orderBreakdown = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { key: 'PENDING_CONFIRM' as OrderStatus, value: d.pendingConfirmOrders },
    { key: 'SERVING' as OrderStatus, value: d.servingOrders },
    { key: 'COMPLETED' as OrderStatus, value: d.completedOrders },
    { key: 'CANCELLED' as OrderStatus, value: d.cancelledOrders }
  ]
})

const isDevQr = computed(() => data.value?.wechatCodeMode === 'DEV')
const trendEmpty = computed(
  () => (data.value?.orderTrend ?? []).every((p) => p.count === 0)
)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">平台概览</h2>
        <p class="page__desc">
          全部指标来自 <code class="mono">GET /api/admin/dashboard</code> 的实时统计，无任何前端写死值。
        </p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-alert
      v-if="isDevQr"
      type="warning"
      show-icon
      :closable="false"
      title="当前微信码为开发降级模式"
      description="后端 wechatCodeMode = DEV，生成的不是真实微信小程序码，请勿对外投放。"
      class="dash__alert"
    />

    <PageState :loading="loading" :error="error" :min-height="320" @retry="load">
      <template v-if="data">
        <div class="stat-grid">
          <div
            v-for="s in stats"
            :key="s.label"
            class="stat"
            :class="{ 'is-link': Boolean(s.to) }"
            @click="s.to && router.push(s.to)"
          >
            <div class="stat__value">{{ s.value }}</div>
            <div class="stat__label">{{ s.label }}</div>
          </div>
        </div>

        <div class="dash-cols">
          <section class="panel">
            <h3 class="panel__title">订单状态分布</h3>
            <table class="kv">
              <tbody>
                <tr v-for="row in orderBreakdown" :key="row.key">
                  <td class="kv__k">{{ ORDER_STATUS_LABEL[row.key] }}</td>
                  <td class="kv__v">{{ row.value }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="panel">
            <h3 class="panel__title">服务者状态</h3>
            <table class="kv">
              <tbody>
                <tr>
                  <td class="kv__k">待审核</td>
                  <td class="kv__v">{{ data.pendingAuditProviders }}</td>
                </tr>
                <tr>
                  <td class="kv__k">已通过</td>
                  <td class="kv__v">{{ data.approvedProviders }}</td>
                </tr>
                <tr>
                  <td class="kv__k">已停用</td>
                  <td class="kv__v">{{ data.disabledProviders }}</td>
                </tr>
                <tr>
                  <td class="kv__k">注册用户总数</td>
                  <td class="kv__v">{{ data.totalUsers }}</td>
                </tr>
                <tr>
                  <td class="kv__k">主页累计访问</td>
                  <td class="kv__v">{{ data.totalVisits }}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <section class="panel">
          <h3 class="panel__title">
            近 7 日订单量趋势
            <span v-if="trendEmpty" class="text-muted" style="font-weight: 400; font-size: 12px">
              近 7 日无新增订单
            </span>
          </h3>
          <TrendChart :points="data.orderTrend" />
        </section>
      </template>
    </PageState>
  </div>
</template>

<style scoped>
.dash__alert {
  margin-bottom: 14px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 18px;
}

.stat.is-link {
  cursor: pointer;
}

.stat.is-link:hover {
  border-color: var(--brand);
}

.stat__value {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.stat__label {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.dash-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 14px;
}

.kv {
  width: 100%;
  border-collapse: collapse;
}

.kv td {
  padding: 9px 0;
  border-bottom: 1px solid var(--border-soft);
  font-size: 13.5px;
}

.kv tr:last-child td {
  border-bottom: none;
}

.kv__k {
  color: var(--text-sub);
}

.kv__v {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .dash-cols {
    grid-template-columns: 1fr;
  }
}
</style>
