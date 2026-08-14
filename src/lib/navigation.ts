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
      { href: "/attribution", label: "True Performance" },
      { href: "/shopify-attribution", label: "Shopify Attribution" },
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
      { href: "/data-quality", label: "Data quality" },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
