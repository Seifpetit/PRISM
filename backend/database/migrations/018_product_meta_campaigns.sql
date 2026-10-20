-- Which Meta campaigns launch which PRISM product. A Meta ad account can run several products, so the Performance
-- tab scopes its numbers to the campaigns assigned to the product you have open. Only the pointer is stored (the
-- Meta campaign id and its name when it was assigned), never Meta's data. A campaign belongs to one product at most,
-- and the assignment goes away with the product.
create table product_meta_campaigns (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  campaign_id text not null,
  campaign_name text not null,
  created_at text not null,
  unique (workspace_id, campaign_id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create index product_meta_campaigns_product_idx on product_meta_campaigns (workspace_id, product_id);
