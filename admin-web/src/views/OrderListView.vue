<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { fetchAdminOrders } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import {
  ORDER_CHANNEL_LABEL,
  ORDER_SOURCE_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_TAG
} from '@/constants/dict'
import type { OrderQuery, OrderStatus, OrderVO } from '@/types/admin'

/** 全平台订单只读视图：管理端不提供任何修改服务者业务记录的操作。 */

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<OrderVO[]>([])
const total = ref(0)

const query = reactive<OrderQuery>({
  keyword: '',
  status: '',
  dateFrom: undefined,
  dateTo: undefined,
  page: 1,
  size: 20
})

const drawer = reactive({ visible: false, current: null as OrderVO | null })

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const page = await fetchAdminOrders({ ...query })
    rows.value = page.records
    total.value = page.total
  } catch {
    rows.value = []
    total.value = 0
    error.value = '订单列表加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void load()
}

function onReset(): void {
  query.keyword = ''
  query.status = ''
  query.dateFrom = undefined
  query.dateTo = undefined
  query.page = 1
  void load()
}

function openDetail(row: OrderVO): void {
  drawer.current = row
  drawer.visible = true
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">全平台订单查询</h2>
        <p class="page__desc">
          只读视图。订单归属与状态流转由服务者端裁决，管理员在此不修改任何业务记录。
        </p>
      </div>
    </div>

    <section class="panel">
      <div class="filter-bar">
        <el-input
          v-model="query.keyword"
          placeholder="客户姓名 / 手机号 / 订单号"
          clearable
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-select v-model="query.status" placeholder="订单状态" clearable @change="onSearch">
          <el-option
            v-for="o in ORDER_STATUS_OPTIONS"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
        <el-date-picker
          v-model="query.dateFrom"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="预约起始日"
          clearable
          @change="onSearch"
        />
        <el-date-picker
          v-model="query.dateTo"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="预约截止日"
          clearable
          @change="onSearch"
        />
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </div>
    </section>

    <section class="panel">
      <PageState :loading="loading" :error="error" :min-height="300" @retry="load">
        <el-table :data="rows" size="small" stripe style="width: 100%">
          <el-table-column prop="orderNo" label="订单号" min-width="200">
            <template #default="{ row }: { row: OrderVO }">
              <span class="mono">{{ row.orderNo || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户" min-width="100" />
          <el-table-column prop="customerPhone" label="手机号" width="120" />
          <el-table-column prop="community" label="小区" min-width="110" />
          <el-table-column prop="address" label="地址" min-width="180" show-overflow-tooltip />
          <el-table-column prop="serviceName" label="服务项目" min-width="120" />
          <el-table-column prop="quantity" label="数量" width="70" align="right" />
          <el-table-column label="预约时段" width="160">
            <template #default="{ row }: { row: OrderVO }">
              <span class="nowrap">{{ row.bookingDate || '—' }} {{ row.bookingSlot || '' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="92">
            <template #default="{ row }: { row: OrderVO }">
              <el-tag v-if="row.status" size="small" :type="ORDER_STATUS_TAG[row.status]">
                {{ row.statusLabel || ORDER_STATUS_LABEL[row.status] }}
              </el-tag>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="100">
            <template #default="{ row }: { row: OrderVO }">
              {{ (row.source && ORDER_SOURCE_LABEL[row.source]) || row.source || '—' }}
            </template>
          </el-table-column>
          <el-table-column label="渠道" width="100">
            <template #default="{ row }: { row: OrderVO }">
              {{ (row.channel && ORDER_CHANNEL_LABEL[row.channel]) || row.channel || '—' }}
            </template>
          </el-table-column>
          <el-table-column label="下单时间" width="160">
            <template #default="{ row }: { row: OrderVO }">
              <span class="text-muted nowrap">
                {{ (row.createdAt || '').replace('T', ' ') || '—' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }: { row: OrderVO }">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="没有符合条件的订单" :image-size="72" />
          </template>
        </el-table>

        <div class="pager">
          <el-pagination
            v-model:current-page="query.page"
            v-model:page-size="query.size"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @current-change="load"
            @size-change="onSearch"
          />
        </div>
      </PageState>
    </section>

    <el-drawer v-model="drawer.visible" title="订单详情（只读）" size="520px">
      <template v-if="drawer.current">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="订单号">
            <span class="mono">{{ drawer.current.orderNo || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="客户">
            {{ drawer.current.customerName || '—' }} · {{ drawer.current.customerPhone || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="地址">
            {{ drawer.current.address || drawer.current.community || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="服务项目">
            {{ drawer.current.serviceName || '—' }} × {{ drawer.current.quantity ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="服务说明">
            {{ drawer.current.serviceDesc || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户备注">
            {{ drawer.current.customerRemark || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="服务者备注">
            {{ drawer.current.providerNote || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="预约时段">
            {{ drawer.current.bookingDate || '—' }} {{ drawer.current.bookingSlot || '' }}
          </el-descriptions-item>
          <el-descriptions-item label="取消原因">
            {{ drawer.current.cancelReason || '—' }}
          </el-descriptions-item>
        </el-descriptions>

        <h4 class="drawer__sub">流转记录</h4>
        <el-timeline v-if="drawer.current.logs && drawer.current.logs.length > 0">
          <el-timeline-item
            v-for="(log, i) in drawer.current.logs"
            :key="i"
            :timestamp="(log.createdAt || '').replace('T', ' ')"
            placement="top"
          >
            <div class="drawer__log-title">{{ log.actionLabel || log.action || '—' }}</div>
            <div class="drawer__log-meta">
              <span v-if="log.operatorName">{{ log.operatorName }}</span>
              <span v-if="log.fromStatus"> · {{ ORDER_STATUS_LABEL[log.fromStatus as OrderStatus] }}</span>
              <span v-if="log.toStatus"> → {{ ORDER_STATUS_LABEL[log.toStatus as OrderStatus] }}</span>
            </div>
            <div v-if="log.remark" class="drawer__log-remark">{{ log.remark }}</div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="该订单暂无流转记录" :image-size="60" />
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.drawer__sub {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.drawer__log-title {
  font-size: 13.5px;
  font-weight: 500;
}

.drawer__log-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.drawer__log-remark {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--text-sub);
}
</style>
