import type { StapeConnectionStatus } from "@/lib/stape/types";
import type { WarehouseModel } from "@/lib/warehouse/constants";

export type WarehouseChannelRow = {
  channel: string;
  orders: number;
  revenue: number;
};

export type WarehouseJourneyRow = {
  path: string;
  orders: number;
  revenue: number;
};

export type WarehouseQuality = {
  totalOrders: number;
  ordersWithTransactionId: number;
  ordersWithPersonId: number;
  ordersWithHashedEmail: number;
  ordersWithGnUid: number;
  ordersWithStapeUserId: number;
  ordersWithShopifyCustomerId: number;
  ordersWithClickId: number;
  ordersWithPrepurchasesSession: number;
  highConfidenceOrders: number;
  mediumConfidenceOrders: number;
  lowConfidenceOrders: number;
  directOrders: number;
  unknownOrders: number;
  attributedOrders: number;
  paidSessions: number;
  paidSessionsWithClickId: number;
  metaSessions: number;
  metaSessionsWithFbclid: number;
  googleSessions: number;
  googleSessionsWithGoogleClickId: number;
  purchaseEventCopies: number;
  canonicalOrders: number;
  identityCollisions: number;
  lateEvents: number;
  orphanTouchpoints: number;
  shopifyGnUidOrders: number;
};

export type WarehouseMetrics = {
  status: StapeConnectionStatus;
  periodLabel: string;
  model: WarehouseModel;
  lookbackDays: number;
  logicVersion: string;
  orders: number;
  revenue: number;
  aov: number;
  newCustomerOrders: number | null;
  returningCustomerOrders: number | null;
  attributedOrders: number;
  attributedRevenue: number;
  coverageRate: number | null;
  highConfidenceRate: number | null;
  directRate: number | null;
  unknownRate: number | null;
  byChannel: WarehouseChannelRow[];
  acquiring: WarehouseChannelRow[];
  closing: WarehouseChannelRow[];
  assisting: WarehouseChannelRow[];
  journeys: WarehouseJourneyRow[];
  avgDaysToPurchase: number | null;
  avgTouchesToPurchase: number | null;
  avgSessionsToPurchase: number | null;
  quality: WarehouseQuality;
  gaps: string[];
};
