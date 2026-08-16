export function gnCampaignExactMatch(
  campaignName: string,
  orders: { firstTouch: { utmCampaign: string }; amount: number }[],
) {
  const name = campaignName.trim().toLowerCase();
  if (!name) {
    return { matched: false, orders: 0, revenue: 0 };
  }
  const matched = orders.filter(
    (order) => order.firstTouch.utmCampaign.trim().toLowerCase() === name,
  );
  return {
    matched: matched.length > 0,
    orders: matched.length,
    revenue: matched.reduce((sum, order) => sum + order.amount, 0),
  };
}
