export type NavItem = {
  href: string;
  label: string;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/sales", label: "Sales" },
  { href: "/traffic", label: "Traffic" },
  { href: "/conversions", label: "Conversions" },
  { href: "/attribution", label: "True Performance" },
  { href: "/products", label: "Products" },
  { href: "/customers", label: "Customers" },
];
