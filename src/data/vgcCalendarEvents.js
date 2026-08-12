const REGIONALS_SOURCE = "https://www.pokemon.com/regionals";
const CHAMPIONSHIPS_SOURCE = "https://championships.pokemon.com/en-us/";

export const VGC_CALENDAR_UPDATED_AT = "2026-08-12";

function scheduledEvent({ id, title, category, start, end = start, location, region, sourceUrl = REGIONALS_SOURCE, notes = "" }) {
  return Object.freeze({
    id: `vgc-${id}`,
    source: "official-vgc",
    event_type: `vgc_${category}`,
    category,
    title,
    starts_at: `${start}T12:00:00`,
    ends_at: `${end}T12:00:00`,
    all_day: true,
    location,
    region,
    source_url: sourceUrl,
    source_label: "Official Play! Pokémon schedule",
    notes,
  });
}

export const VGC_CALENDAR_EVENTS = Object.freeze([
  scheduledEvent({ id: "worlds-2026", title: "2026 Pokémon World Championships — VGC", category: "worlds", start: "2026-08-28", end: "2026-08-30", location: "San Francisco, California, United States", region: "North America", sourceUrl: CHAMPIONSHIPS_SOURCE, notes: "The season-ending Pokémon Video Game Championships at the 2026 Pokémon World Championships." }),
  scheduledEvent({ id: "baltimore-2027", title: "Baltimore Regional Championships — VGC", category: "regional", start: "2026-09-18", end: "2026-09-20", location: "Baltimore, Maryland, United States", region: "North America" }),
  scheduledEvent({ id: "frankfurt-2027", title: "Frankfurt Regional Championships — VGC", category: "regional", start: "2026-09-26", end: "2026-09-27", location: "Frankfurt, Germany", region: "Europe" }),
  scheduledEvent({ id: "brisbane-2027", title: "Brisbane Regional Championships — VGC", category: "regional", start: "2026-09-26", end: "2026-09-27", location: "Brisbane, Australia", region: "Oceania" }),
  scheduledEvent({ id: "recife-2027", title: "Recife Regional Championships — VGC", category: "regional", start: "2026-10-03", end: "2026-10-04", location: "Recife, Brazil", region: "Latin America" }),
  scheduledEvent({ id: "louisville-2027", title: "Louisville Regional Championships — VGC", category: "regional", start: "2026-10-09", end: "2026-10-11", location: "Louisville, Kentucky, United States", region: "North America" }),
  scheduledEvent({ id: "nice-2027", title: "Nice Regional Championships — VGC", category: "regional", start: "2026-10-17", end: "2026-10-18", location: "Nice, France", region: "Europe" }),
  scheduledEvent({ id: "puebla-2027", title: "Puebla Regional Championships — VGC", category: "regional", start: "2026-10-24", end: "2026-10-25", location: "Puebla, Mexico", region: "Latin America" }),
  scheduledEvent({ id: "gdansk-2027", title: "Gdańsk Regional Championships — VGC", category: "regional", start: "2026-10-31", end: "2026-11-01", location: "Gdańsk, Poland", region: "Europe" }),
  scheduledEvent({ id: "buenos-aires-2027", title: "Buenos Aires Special Championships — VGC", category: "special", start: "2026-11-14", end: "2026-11-15", location: "Buenos Aires, Argentina", region: "Latin America" }),
  scheduledEvent({ id: "laic-2027", title: "Latin America International Championships — VGC", category: "international", start: "2026-11-20", end: "2026-11-22", location: "São Paulo, Brazil", region: "Latin America", sourceUrl: CHAMPIONSHIPS_SOURCE }),
  scheduledEvent({ id: "stuttgart-2027", title: "Stuttgart Regional Championships — VGC", category: "regional", start: "2026-11-28", end: "2026-11-29", location: "Stuttgart, Germany", region: "Europe" }),
  scheduledEvent({ id: "las-vegas-2027", title: "Las Vegas Regional Championships — VGC", category: "regional", start: "2026-12-04", end: "2026-12-06", location: "Las Vegas, Nevada, United States", region: "North America" }),
  scheduledEvent({ id: "sydney-2027", title: "Sydney Regional Championships — VGC", category: "regional", start: "2027-01-16", end: "2027-01-17", location: "Sydney, Australia", region: "Oceania" }),
  scheduledEvent({ id: "merida-2027", title: "Mérida Regional Championships — VGC", category: "regional", start: "2027-01-23", end: "2027-01-24", location: "Mérida, Mexico", region: "Latin America" }),
  scheduledEvent({ id: "birmingham-2027", title: "Birmingham Regional Championships — VGC", category: "regional", start: "2027-01-30", end: "2027-01-31", location: "Birmingham, United Kingdom", region: "Europe" }),
  scheduledEvent({ id: "auckland-2027", title: "Auckland Special Championships — VGC", category: "special", start: "2027-01-30", end: "2027-01-31", location: "Auckland, New Zealand", region: "Oceania" }),
  scheduledEvent({ id: "euic-2027", title: "Europe International Championships — VGC", category: "international", start: "2027-02-19", end: "2027-02-21", location: "London, United Kingdom", region: "Europe", sourceUrl: CHAMPIONSHIPS_SOURCE }),
  scheduledEvent({ id: "santiago-2027", title: "Santiago Regional Championships — VGC", category: "regional", start: "2027-02-27", end: "2027-02-28", location: "Santiago, Chile", region: "Latin America" }),
  scheduledEvent({ id: "rio-2027", title: "Rio de Janeiro Regional Championships — VGC", category: "regional", start: "2027-03-06", end: "2027-03-07", location: "Rio de Janeiro, Brazil", region: "Latin America" }),
  scheduledEvent({ id: "lisbon-2027", title: "Lisbon Special Championships — VGC", category: "special", start: "2027-04-10", end: "2027-04-11", location: "Lisbon, Portugal", region: "Europe" }),
  scheduledEvent({ id: "monterrey-2027", title: "Monterrey Regional Championships — VGC", category: "regional", start: "2027-04-10", end: "2027-04-11", location: "Monterrey, Mexico", region: "Latin America" }),
  scheduledEvent({ id: "milwaukee-2027", title: "Milwaukee Regional Championships — VGC", category: "regional", start: "2027-04-16", end: "2027-04-18", location: "Milwaukee, Wisconsin, United States", region: "North America" }),
  scheduledEvent({ id: "lima-2027", title: "Lima Special Championships — VGC", category: "special", start: "2027-04-24", end: "2027-04-25", location: "Lima, Peru", region: "Latin America" }),
  scheduledEvent({ id: "prague-2027", title: "Prague Regional Championships — VGC", category: "regional", start: "2027-05-08", end: "2027-05-09", location: "Prague, Czechia", region: "Europe" }),
  scheduledEvent({ id: "porto-alegre-2027", title: "Porto Alegre Regional Championships — VGC", category: "regional", start: "2027-05-08", end: "2027-05-09", location: "Porto Alegre, Brazil", region: "Latin America" }),
  scheduledEvent({ id: "utrecht-2027", title: "Utrecht Regional Championships — VGC", category: "regional", start: "2027-05-22", end: "2027-05-23", location: "Utrecht, Netherlands", region: "Europe" }),
  scheduledEvent({ id: "san-diego-2027", title: "San Diego Regional Championships — VGC", category: "regional", start: "2027-05-28", end: "2027-05-30", location: "San Diego, California, United States", region: "North America" }),
  scheduledEvent({ id: "melbourne-2027", title: "Melbourne Regional Championships — VGC", category: "regional", start: "2027-05-29", end: "2027-05-30", location: "Melbourne, Australia", region: "Oceania" }),
  scheduledEvent({ id: "bologna-2027", title: "Bologna Special Championships — VGC", category: "special", start: "2027-06-05", end: "2027-06-06", location: "Bologna, Italy", region: "Europe" }),
  scheduledEvent({ id: "naic-2027", title: "North America International Championships — VGC", category: "international", start: "2027-06-18", end: "2027-06-20", location: "Chicago, Illinois, United States", region: "North America", sourceUrl: CHAMPIONSHIPS_SOURCE }),
]);

export const VGC_CALENDAR_REGIONS = Object.freeze(["All regions", "North America", "Europe", "Latin America", "Oceania"]);
