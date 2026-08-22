import { CATEGORY_SCOPES, categoryHref } from "@/lib/categories";

export function CategoryNav() {
  return (
    <nav className="site-category-nav" aria-label="Explore post categories">
      <div className="site-category-nav__inner site-shell">
        <span className="site-category-nav__label" aria-hidden="true">
          Explore
        </span>
        <a
          className="site-category-nav__item"
          href={categoryHref("anything")}
        >
          All
        </a>
        {CATEGORY_SCOPES.map((category) => (
          <a
            className="site-category-nav__item"
            href={categoryHref(category.value)}
            key={category.value}
          >
            {category.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
