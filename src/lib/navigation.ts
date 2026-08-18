export type NavIcon =
  | "summary"
  | "overview"
  | "sales"
  | "traffic"
  | "conversions"
  | "products"
  | "attribution"
  | "warehouse"
  | "customers"
  | "data";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Command center",
    items: [
      { href: "/summary", label: "Summary", icon: "summary" },
      { href: "/", label: "Overview", icon: "overview" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/sales", label: "Sales", icon: "sales" },
      { href: "/traffic", label: "Traffic", icon: "traffic" },
      { href: "/conversions", label: "Conversions", icon: "conversions" },
      { href: "/products", label: "Products", icon: "products" },
    ],
  },
  {
    label: "Attribution",
    items: [
      { href: "/attribution", label: "True Performance", icon: "attribution" },
      { href: "/warehouse", label: "Warehouse", icon: "warehouse" },
    ],
  },
  {
    label: "Customers",
    items: [{ href: "/customers", label: "Customers", icon: "customers" }],
  },
  {
    label: "Data",
    items: [{ href: "/data-quality", label: "Data quality", icon: "data" }],
  },
];

/** Flat list kept for any consumer that just needs hrefs/labels. */
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
