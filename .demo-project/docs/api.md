# Payments API

> **状态：v0 提案（草案）— 未与实现对齐**
> 仓库内暂无本接口的实现（无 handler / OpenAPI / schema）。下列字段名、错误码与幂等语义
> 均为按 Stripe 风格给出的**提议**，标注 `待确认` 的条目须与实现核对后才能作为对外契约。
> 示例中的 ID 均为构造值。维护者：falcon 项目线程 · 2026-10-23

## 1. 通用约定（待确认）

| 项 | 约定 |
| --- | --- |
| Base URL | `{base_url}/v1` `待确认` |
| 认证 | `Authorization: Bearer <secret_key>` |
| 内容类型 | `application/json; charset=utf-8` |
| 金额 | 整数，最小货币单位（如 1 元 = `100`） |
| 币种 | ISO-4217 小写三字母，如 `usd`、`cny` |
| 时间 | RFC 3339 UTC，如 `2026-10-23T05:17:57Z` |
| 追踪 | 响应头 `Request-Id`，排查问题时提供 |

## 2. POST /v1/charges

创建一笔支付。成功返回 `201`。

### 2.1 请求头

| Header | 必填 | 说明 |
| --- | --- | --- |
| `Authorization` | 是 | `Bearer <secret_key>` |
| `Content-Type` | 是 | `application/json` |
| `Idempotency-Key` | 否（强烈建议） | 幂等键，见 2.5 |
| `X-Merchant-Id` | 视部署 `待确认` | 多商户部署时指定商户 |

### 2.2 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `amount` | integer | 是 | 金额（最小货币单位），`> 0`，上限 `待确认` |
| `currency` | string | 是 | ISO-4217 小写三字母 |
| `customer_id` | string | 是 | 客户标识，对应 `charges.customer_id` |
| `description` | string | 否 | 最长 500 字符 |
| `reference` | string | 否 | 商户侧订单号，≤ 64 字符，用于对账 |
| `metadata` | object\<string,string\> | 否 | 最多 50 对；键 ≤ 40、值 ≤ 500 字符 |
| `capture` | boolean | 否 | 默认 `true`；`false` 仅授权，之后需 capture `待确认` |

```json
{
  "amount": 1999,
  "currency": "usd",
  "customer_id": "cus_NXy8kQ2rTf",
  "description": "Order #1234",
  "reference": "order-1234",
  "metadata": { "order_id": "1234" },
  "capture": true
}
```

### 2.3 响应

#### 成功 201

```json
{
  "id": "ch_3Pq7Yk2rTf9aLe",
  "object": "charge",
  "amount": 1999,
  "currency": "usd",
  "status": "succeeded",
  "captured": true,
  "customer_id": "cus_NXy8kQ2rTf",
  "description": "Order #1234",
  "reference": "order-1234",
  "metadata": { "order_id": "1234" },
  "created_at": "2026-10-23T05:17:57Z",
  "livemode": false
}
```

`status` 取值 `待确认`：`pending` | `succeeded` | `failed` | `refunded` | `partially_refunded`。

#### 错误信封

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "amount_invalid",
    "message": "amount must be a positive integer",
    "param": "amount",
    "request_id": "req_9f2b1c"
  }
}
```

### 2.4 错误码（`待确认`：需与网关实际返回核对）

| HTTP | `type` | `code` | 场景 |
| --- | --- | --- | --- |
| 400 | `invalid_request_error` | `invalid_json` | 请求体不是合法 JSON |
| 400 | `invalid_request_error` | `amount_invalid` | 缺失 / 非正整数 / 超上限 |
| 400 | `invalid_request_error` | `currency_unsupported` | 币种不在支持列表 |
| 400 | `invalid_request_error` | `customer_not_found` | `customer_id` 不存在 |
| 400 | `invalid_request_error` | `metadata_too_large` | 键值对数量或长度超限 |
| 401 | `authentication_error` | `invalid_api_key` | 密钥缺失或无效 |
| 402 | `card_error` | `card_declined` | 发卡行拒绝 |
| 402 | `card_error` | `insufficient_funds` | 余额不足 |
| 402 | `card_error` | `expired_card` | 卡片过期 |
| 409 | `idempotency_error` | `idempotency_key_reuse` | 同键但请求体不同 |
| 409 | `idempotency_error` | `idempotency_in_progress` | 同键首请求仍在处理中 |
| 429 | `rate_limit_error` | `too_many_requests` | 触发限流，返回 `Retry-After` |
| 500 | `api_error` | `internal_error` | 服务端异常，可用同键重试 |
| 503 | `api_error` | `service_unavailable` | 暂时不可用，可用同键重试 |

### 2.5 幂等性

- **作用域**：`(merchant, endpoint, Idempotency-Key)`，互不串用；建议每笔新支付换一个键。
- **键格式**：1–255 字符，`[A-Za-z0-9_-]`；推荐 UUID v4 或「业务单号 + 盐」。
- **窗口**：默认 24 小时（`86400s`）`待确认`；过期后同键视为新请求。
- **命中回放**：键相同且请求体（规范化后哈希）相同 → 返回首次结果，沿用原状态码与响应体，并带 `Idempotent-Replayed: true`。
- **键冲突**：键相同但请求体不同 → `409 idempotency_key_reuse`。
- **并发**：首请求未完成时同键再次到达 → `409 idempotency_in_progress`（或阻塞后回放，方案 `待确认`）。
- **不缓存的情况** `待确认`：`400`/`401` 校验失败与 `500` 不写入幂等记录；`429` 可立即用同键重试。
- **重试建议**：网络超时 / `5xx` / `429` → 同键重试；其余 `4xx` → 修正后再发。

#### 幂等回放示例

```http
HTTP/1.1 201 Created
Content-Type: application/json
Idempotent-Replayed: true
Request-Id: req_9f2b1c
```

```json
{
  "id": "ch_3Pq7Yk2rTf9aLe",
  "object": "charge",
  "status": "succeeded",
  "amount": 1999,
  "currency": "usd"
}
```

### 2.6 调用示例

```bash
curl -X POST "$BASE_URL/v1/charges" \
  -H "Authorization: Bearer $SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 6a1f0c2e-7d4b-4f2a-9e3c-1b8d5a0f7c91" \
  -d '{
    "amount": 1999,
    "currency": "usd",
    "customer_id": "cus_NXy8kQ2rTf",
    "reference": "order-1234"
  }'
```

## 3. 待确认清单

1. Base URL、认证方式与 `X-Merchant-Id` 是否适用。
2. `amount` 上限；是否允许 `0`（预授权场景）。
3. `capture` / `reference` 是否已在实现中支持。
4. 幂等窗口时长；`in_progress` 是返回 `409` 还是阻塞等首请求完成。
5. 错误码集合是否与网关一致，是否需要 `param` 字段。
6. 是否需要 `statement_descriptor`（账单展示名）。
7. `src/queries.sql` 按 `customer_id` + `created_at` 排序，是否意味着还需 `GET /v1/charges` 列表接口。
