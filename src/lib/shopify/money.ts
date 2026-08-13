export type ShopMoneySet =
  | {
      shopMoney?: {
        amount?: string | null;
        currencyCode?: string | null;
      } | null;
    }
  | null
  | undefined;

export type MoneyV2 =
  | {
      amount?: string | null;
      currencyCode?: string | null;
    }
  | null
  | undefined;

export function shopMoneyAmount(set: ShopMoneySet) {
  const amount = Number(set?.shopMoney?.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function moneyV2Amount(money: MoneyV2) {
  const amount = Number(money?.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

const SALE_KINDS = new Set(["SALE", "CAPTURE"]);
const REFUND_KINDS = new Set(["REFUND"]);

export type OrderTransactionNode = {
  kind?: string | null;
  status?: string | null;
  gateway?: string | null;
  fees?: {
    amount?: MoneyV2;
    type?: string | null;
  }[] | null;
};

function feeTotal(transaction: OrderTransactionNode) {
  return (transaction.fees ?? []).reduce(
    (total, fee) => total + moneyV2Amount(fee.amount),
    0,
  );
}

function successful(transaction: OrderTransactionNode) {
  return (transaction.status || "").toUpperCase() === "SUCCESS";
}

/** Shopify Payments fees only. Empty fees → null, never a guessed $0. */
export function transactionFees(transactions: OrderTransactionNode[] | null | undefined) {
  const rows = transactions ?? [];
  let processingFees: number | null = null;
  let refundFees: number | null = null;

  for (const transaction of rows) {
    if (!successful(transaction)) {
      continue;
    }

    const kind = (transaction.kind || "").toUpperCase();
    const fees = transaction.fees ?? [];
    if (fees.length === 0) {
      continue;
    }

    const amount = feeTotal(transaction);
    if (SALE_KINDS.has(kind)) {
      processingFees = (processingFees ?? 0) + amount;
    } else if (REFUND_KINDS.has(kind)) {
      refundFees = (refundFees ?? 0) + amount;
    }
  }

  return { processingFees, refundFees };
}
