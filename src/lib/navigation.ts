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
      { href: "/summary", label: "Summary" },
      { href: "/", label: "Overview" },
    ],
  },
  {
    label: "Acquisition",
    items: [
      { href: "/attribution/overview", label: "Attribution" },
      { href: "/attribution-models", label: "Models" },
      { href: "/journeys", label: "Journeys" },
      { href: "/attribution", label: "First-touch" },
      { href: "/meta", label: "Meta Ads" },
      { href: "/meta/creatives", label: "Creatives" },
      { href: "/traffic", label: "Traffic" },
      { href: "/landing-pages", label: "Landing pages" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/sales", label: "Sales" },
      { href: "/conversions", label: "Funnel" },
      { href: "/products", label: "Products" },
      { href: "/customers", label: "Customers" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/health", label: "Tracking health" },
      { href: "/data-quality", label: "Data quality" },
      { href: "/warehouse", label: "Warehouse QA" },
      { href: "/integrations", label: "Integrations" },
    ],
  },
  {
    label: "AI",
    items: [{ href: "/ai", label: "Ask Analytics" }],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
