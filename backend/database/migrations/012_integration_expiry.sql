-- Tokens obtained through OAuth can expire (Meta's long-lived tokens last about 60 days), unlike a
-- Shopify offline token. Storing when lets PRISM warn before a connection silently stops working.
-- NULL means the token is not known to expire (Shopify, or a pasted never-expiring token).
alter table integration_connections add column expires_at text;
