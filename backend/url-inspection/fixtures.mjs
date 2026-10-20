const url = "https://shop.example";

function document({ title, head = "", body }) {
  return `<!doctype html>
    <html>
      <head><title>${title}</title>${head}</head>
      <body>${body}</body>
    </html>`;
}

function productJson({ name, slug, price, description = "", image = "" }) {
  const offer =
    price === undefined
      ? ""
      : `,"offers":{"@type":"Offer","price":"${price}","priceCurrency":"USD"}`;
  return `<script type="application/ld+json">{
    "@context":"https://schema.org",
    "@type":"Product",
    "name":"${name}",
    "url":"${url}/products/${slug}",
    "description":"${description}",
    "image":"${image}"${offer}
  }</script>`;
}

function productCard(index, { name = `Product ${index}`, price = 40 + index } = {}) {
  return `<article class="product-card">
    <a href="/products/item-${index}">${name}</a>
    <img src="/images/item-${index}.jpg" alt="${name}">
    <span>$${price}.00</span>
    <p>A useful product for everyday comfort.</p>
  </article>`;
}

function collectionCards(count, options) {
  return Array.from({ length: count }, (_value, index) =>
    productCard(index + 1, options?.(index + 1)),
  ).join("\n");
}

export const htmlFixtures = [
  {
    name: "clear Shopify-like product page",
    expected: "PRODUCT",
    html: document({
      title: "Cloud Pillow | Northstar",
      head: `${productJson({
        name: "Cloud Pillow",
        slug: "cloud-pillow",
        price: 129,
        description: "Cooling memory foam support for side sleepers.",
        image: `${url}/images/cloud.jpg`,
      })}
        <meta property="og:title" content="Cloud Pillow">
        <meta property="og:image" content="${url}/images/cloud.jpg">
        <link rel="canonical" href="${url}/products/cloud-pillow">`,
      body: `<h1>Cloud Pillow</h1>
        <div class="product-gallery"><img src="/images/cloud.jpg"></div>
        <p>Cooling memory foam support designed for side sleepers.</p>
        <p>SKU: CLOUD-129</p><span>$129.00</span>
        <select name="size"><option>Standard</option></select>
        <button>Add to cart</button>`,
    }),
  },
  {
    name: "product landing page without price",
    expected: "PRODUCT",
    html: document({
      title: "Rest Mat",
      head: productJson({
        name: "Rest Mat",
        slug: "rest-mat",
        description: "A supportive mat designed for restorative evenings.",
        image: `${url}/images/rest-mat.jpg`,
      }),
      body: `<h1>Rest Mat</h1><div class="product-gallery">
        <img src="/images/rest-mat.jpg"></div>
        <p>A supportive mat designed for restorative evenings at home.</p>
        <button>Buy now</button>`,
    }),
  },
  {
    name: "single-product brand homepage",
    expected: "PRODUCT",
    html: document({
      title: "The Better Bottle",
      head: productJson({
        name: "The Better Bottle",
        slug: "better-bottle",
        description: "The refillable bottle built to keep water cold all day.",
        image: `${url}/images/bottle.jpg`,
      }),
      body: `<h1>The Better Bottle</h1><div class="product-gallery">
        <img src="/images/bottle.jpg"></div>
        <p>The refillable bottle built to keep water cold all day.</p>
        <button>Add to cart</button>`,
    }),
  },
  {
    name: "rendered single-product landing page without structured data",
    expected: "PRODUCT",
    html: document({
      title: "NutriVie",
      head: `<script id="storeData" type="application/json">
        {"checkoutInstructions":"Commander maintenant via WhatsApp"}
      </script>`,
      body: `<h1>Natural weight loss with NutriVie Goji</h1>
        <div class="product-gallery"><img class="product-image" src="/images/nutrivie.jpg"></div>
        <p>A natural formula designed to support sustained weight management.</p>`,
    }),
  },
  {
    name: "OpenGraph-only product page without a heading",
    expected: "PRODUCT",
    html: document({
      title: "Product",
      head: `<meta property="og:type" content="product">
        <meta property="og:title" content="NutriVie Slimora">
        <meta property="og:image" content="${url}/images/slimora.jpg">
        <meta name="description" content="A natural formula for supported weight management.">`,
      body: `<div class="product-gallery"><img src="/images/slimora.jpg"></div>
        <p>A natural formula for supported weight management.</p>
        <a href="https://wa.me/123456">Commander maintenant</a>`,
    }),
  },
  {
    name: "collection page with 12 products",
    expected: "LISTING",
    expectedListingScope: "SELECTABLE",
    html: document({
      title: "Shop all products",
      head: `<script type="application/ld+json">{
        "@context":"https://schema.org","@type":"ItemList"
      }</script>`,
      body: `<h1>Shop all products</h1><main class="collection product-grid">
        ${collectionCards(12)}</main>`,
    }),
  },
  {
    name: "store homepage with similarly prominent products",
    expected: "LISTING",
    expectedListingScope: "SELECTABLE",
    html: document({
      title: "Northstar Store",
      body: `<h1>Northstar Store</h1><main class="product-grid">
        ${collectionCards(5)}</main>`,
    }),
  },
  {
    name: "broad catalog with 30 products",
    expected: "LISTING",
    expectedListingScope: "BROAD_CATALOG",
    html: document({
      title: "Everyday collection",
      body: `<h1>Everyday collection</h1><main class="collection product-grid">
        ${collectionCards(30)}</main>`,
    }),
  },
  {
    name: "paginated catalog with five products",
    expected: "LISTING",
    expectedListingScope: "BROAD_CATALOG",
    html: document({
      title: "Seasonal products",
      body: `<h1>Seasonal products</h1><main class="collection product-grid">
        ${collectionCards(5)}</main><nav class="pagination"><a rel="next" href="?page=2">Next</a></nav>`,
    }),
  },
  {
    name: "brand about page",
    expected: "UNKNOWN",
    html: document({
      title: "About Northstar",
      body: `<h1>About Northstar</h1><p>${"Our small team makes thoughtful home goods. ".repeat(8)}</p>`,
    }),
  },
  {
    name: "blog article page",
    expected: "UNKNOWN",
    html: document({
      title: "Five better sleep habits",
      head: `<meta property="og:type" content="article">
        <script type="application/ld+json">{
          "@context":"https://schema.org","@type":"BlogPosting"
        }</script>`,
      body: `<article><h1>Five better sleep habits</h1>
        <p>${"A practical article about creating a better evening routine. ".repeat(8)}</p>
      </article>`,
    }),
  },
  {
    name: "ambiguous homepage with product and listing signals",
    expected: "UNKNOWN",
    html: document({
      title: "Cloud Pillow and more",
      head: `${productJson({
        name: "Cloud Pillow",
        slug: "cloud-pillow",
        price: 129,
        description: "Cooling memory foam support for side sleepers.",
        image: `${url}/images/cloud.jpg`,
      })}<script type="application/ld+json">{
        "@context":"https://schema.org","@type":"ItemList"
      }</script>`,
      body: `<h1>Cloud Pillow</h1><div class="product-gallery">
        <img src="/images/cloud.jpg"></div><p>Cooling memory foam support.</p>
        <p>SKU: CLOUD-129</p><span>$129.00</span><button>Add to cart</button>
        <main class="collection product-grid">
          ${collectionCards(5, (index) => ({ name: "Featured companions", price: 30 + index }))}
        </main>`,
    }),
  },
  {
    name: "one dominant hero product with weak secondary links",
    expected: "PRODUCT",
    html: document({
      title: "Cloud Pillow",
      head: productJson({
        name: "Cloud Pillow",
        slug: "cloud-pillow",
        price: 129,
        description: "Cooling memory foam support for side sleepers.",
        image: `${url}/images/cloud.jpg`,
      }),
      body: `<h1>Cloud Pillow</h1><div class="product-gallery">
        <img src="/images/cloud.jpg"></div><p>Cooling memory foam support.</p>
        <span>$129.00</span><button>Add to cart</button>
        <footer><a href="/products/case">Carry case</a>
          <a href="/products/cover">Replacement cover</a></footer>`,
    }),
  },
];

export function pageForFixture(fixture) {
  return {
    requestedUrl: `${url}/start`,
    finalUrl: `${url}/final`,
    httpStatus: 200,
    contentType: "text/html; charset=utf-8",
    html: fixture.html,
  };
}
