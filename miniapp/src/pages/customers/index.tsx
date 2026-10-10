import { useCallback, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PageState from '@/components/PageState'
import { fetchCustomers } from '@/api/provider'
import { usePageData } from '@/hooks/usePageData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import type { CustomerVO } from '@/types/domain'

const PAGE_SIZE = 20

/** 我的客户：搜索 + 分页，点击进入客户详情 */
export default function CustomersPage() {
  useAuthGuard()
  const [keyword, setKeyword] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [page, setPage] = useState(1)

  const fetcher = useCallback(
    () => fetchCustomers(submitted || undefined, page, PAGE_SIZE),
    [submitted, page]
  )
  const { data, loading, error, reload } = usePageData(fetcher, [submitted, page])

  const records = data?.records || []
  const total = data?.total || 0

  const doSearch = () => {
    setSubmitted(keyword.trim())
    setPage(1)
  }

  const clear = () => {
    setKeyword('')
    setSubmitted('')
    setPage(1)
  }

  const goDetail = (customer: CustomerVO) => {
    Taro.navigateTo({ url: `/pages/customer-detail/index?id=${customer.id}` })
  }

  return (
    <View className='page'>
      <View className='searchbar'>
        <Text className='muted'>搜索</Text>
        <Input
          className='searchbar__input'
          value={keyword}
          placeholder='客户姓名 / 手机号 / 小区'
          placeholderClass='form-item__placeholder'
          confirmType='search'
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={doSearch}
        />
        {submitted ? (
          <Text className='link' onClick={clear}>
            清除
          </Text>
        ) : (
          <Text className='link' onClick={doSearch}>
            搜索
          </Text>
        )}
      </View>

      <View className='section-head'>
        <Text className='section-head__title'>客户</Text>
        <Text className='muted'>{loading ? '加载中…' : `共 ${total} 位`}</Text>
      </View>

      <PageState
        loading={loading && page === 1}
        error={error}
        empty={!error && records.length === 0}
        emptyTitle={submitted ? '没有匹配的客户' : '还没有客户'}
        emptyDesc={
          submitted ? '换个关键字试试。' : '客户通过推广码下单后会自动进入这里。'
        }
        skeleton={page === 1}
        onRetry={reload}
      >
        {records.map((c) => (
          <View key={c.id} className='card card--tap' onClick={() => goDetail(c)}>
            <View className='row row--between'>
              <Text className='title'>{c.name}</Text>
              <Text className='tag'>{`${c.orderCount} 单`}</Text>
            </View>
            <View className='order-card__meta'>
              <Text className='order-card__dot'>○</Text>
              <Text className='grow'>{c.phone}</Text>
            </View>
            <View className='order-card__meta'>
              <Text className='order-card__dot'>◎</Text>
              <Text className='grow'>{c.address || c.community || '—'}</Text>
            </View>
            {!!c.nextServiceAt && (
              <View className='order-card__meta'>
                <Text className='order-card__dot'>↻</Text>
                <Text className='grow'>计划复购：{String(c.nextServiceAt).slice(0, 10)}</Text>
              </View>
            )}
          </View>
        ))}
        {records.length > 0 && (
          <View
            className='loadmore'
            onClick={() => {
              if (!loading && records.length < total) setPage(page + 1)
            }}
          >
            {records.length < total ? '点击加载更多' : '没有更多了'}
          </View>
        )}
      </PageState>
    </View>
  )
}