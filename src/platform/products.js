const products = {
  collector: {
    id: "collector",
    name: "Pokédex Tracker",
    eyebrow: "COLLECTION APP",
    homePath: "/pokedex-tracker/",
    icon: "/pokedex-collector-icon-192.png",
    routePrefixes: ["/pokedex-tracker"],
    navigation: [
      { label: "Dex", compactLabel: "Dex", href: "/pokedex-tracker/#dex-tracker-workspace" },
      { label: "Rescue", compactLabel: "Rescue", href: "/pokedex-tracker/#bank-rescue" },
      { label: "Collection", compactLabel: "Collect", href: "/pokedex-tracker/#collection-inventory" },
      { label: "Boxes", compactLabel: "Boxes", href: "/pokedex-tracker/#home-box-planner" },
      { label: "More", compactLabel: "More", href: "/pokedex-tracker/#collector-tools" },
    ],
  },
  teamLab: {
    id: "team-lab",
    name: "Team Lab",
    eyebrow: "BATTLE PLANNING APP",
    homePath: "/team-lab/",
    icon: "/draftcenter-logo.png",
    routePrefixes: ["/team-lab", "/tools/team-builder", "/my-teams"],
    navigation: [
      { label: "Build", compactLabel: "Build", href: "/team-lab/" },
      { label: "Battle Room", compactLabel: "Battle", href: "/team-lab/#team-lab-battle-setup" },
      { label: "My Teams", compactLabel: "Teams", href: "/team-lab/teams" },
      { label: "Install", compactLabel: "Install", href: "/team-lab/#install-team-lab" },
    ],
  },
};

export const PLATFORM_PRODUCTS = Object.freeze(products);

function normalizedPathname(value) {
  const pathname = String(value || "/").split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return pathname || "/";
}

export function pathMatchesPrefix(pathname, prefix) {
  const path = normalizedPathname(pathname);
  const normalizedPrefix = normalizedPathname(prefix);
  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
}

export function productForPathname(pathname) {
  return Object.values(PLATFORM_PRODUCTS).find((product) =>
    product.routePrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix))) || null;
}

export const PRODUCT_ROUTES = Object.freeze({
  collector: "/pokedex-tracker/",
  teamLab: "/team-lab/",
  teamLabTeams: "/team-lab/teams",
  legacyTeamLab: "/tools/team-builder",
  legacyMyTeams: "/my-teams",
});
