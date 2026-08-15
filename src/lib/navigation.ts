export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Overview" },
      { href: "/sales", label: "Sales" },
      { href: "/meta", label: "Meta Ads" },
      { href: "/meta/creatives", label: "Creatives" },
      { href: "/attribution", label: "True Performance" },
    ],
  },
  {
    label: "Funnel",
    items: [
      { href: "/traffic", label: "Traffic" },
      { href: "/conversions", label: "Conversions" },
      { href: "/warehouse", label: "Warehouse" },
    ],
  },
  {
    label: "Store",
    items: [
      { href: "/products", label: "Products" },
      { href: "/customers", label: "Customers" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/health", label: "Data health" },
      { href: "/data-quality", label: "Data quality" },
      { href: "/integrations", label: "Integrations" },
      { href: "/ai", label: "Ask AI" },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
