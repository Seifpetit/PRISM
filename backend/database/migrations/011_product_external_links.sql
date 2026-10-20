-- Links a PRISM product to the same product in an external store (Shopify first), so sales for that
-- product can be looked up later. Only the pointer is stored (store domain, external product id and the
-- title at link time), never the store's data. One link per PRISM product per provider; linking again
-- replaces it. Removed automatically when the PRISM product is deleted.
create table product_external_links (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  provider text not null,
  external_account_id text not null,
  external_id text not null,
  external_title text not null,
  created_at text not null,
  updated_at text not null,
  unique (workspace_id, product_id, provider),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create index product_external_links_lookup_idx
  on product_external_links (workspace_id, provider, external_id);
