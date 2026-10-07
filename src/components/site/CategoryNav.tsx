import { getTranslator } from "@/lib/i18n/server";
import Link from "next/link";
import { CATEGORY_SCOPES, categoryHref } from "@/lib/categories";

export async function CategoryNav() {
  const t = await getTranslator();
  return (
    <nav className="site-category-nav" aria-label={t("Explore post categories")}>
      <div className="site-category-nav__inner site-shell">
        <span className="site-category-nav__label" aria-hidden="true"> {t("Explore")} </span>
        <Link
          className="site-category-nav__item"
          href={categoryHref("anything")}
          prefetch={false}
        > {t("All")} </Link>
        {CATEGORY_SCOPES.map((category) => (
          <Link
            className="site-category-nav__item"
            href={categoryHref(category.value)}
            prefetch={false}
            key={category.value}
          >
            {t(category.label)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
