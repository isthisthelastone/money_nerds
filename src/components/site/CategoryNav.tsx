import Link from "next/link";
import { CATEGORY_SCOPES, categoryHref } from "@/lib/categories";

export function CategoryNav() {
  return (
    <nav className="site-category-nav" aria-label="Explore post categories">
      <div className="site-category-nav__inner site-shell">
        <span className="site-category-nav__label" aria-hidden="true">
          Explore
        </span>
        <Link
          className="site-category-nav__item"
          href={categoryHref("anything")}
          prefetch={false}
        >
          All
        </Link>
        {CATEGORY_SCOPES.map((category) => (
          <Link
            className="site-category-nav__item"
            href={categoryHref(category.value)}
            prefetch={false}
            key={category.value}
          >
            {category.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
