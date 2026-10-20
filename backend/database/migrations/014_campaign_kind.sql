-- What a campaign is for. A test campaign compares one variable (see test_type); scaling and retargeting are
-- labels for now and reuse the same ad set builder. Existing campaigns were all tests.
alter table campaigns add column kind text not null default 'test' check (kind in ('test', 'scaling', 'retargeting'));
