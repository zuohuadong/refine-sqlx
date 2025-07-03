-- Example database schema for refine-sqlite with Cloudflare D1
-- Run this with: wrangler d1 execute your-database-name --file=./migrations/001_initial.sql

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    category_id INTEGER,
    published BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample categories
INSERT OR IGNORE INTO categories (id, name, description) VALUES 
(1, 'Technology', 'Posts about technology and programming'),
(2, 'Lifestyle', 'Posts about lifestyle and personal experiences'),
(3, 'Business', 'Posts about business and entrepreneurship');

-- Insert sample posts
INSERT OR IGNORE INTO posts (id, title, content, category_id, published) VALUES 
(1, 'Soluta et est est.', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', 2, 1),
(2, 'Voluptatem eligendi optio.', 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', 1, 1),
(3, 'Eum fuga consequatur.', 'Ut enim ad minim veniam, quis nostrud exercitation ullamco.', 3, 0),
(4, 'Numquam eius modi.', 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.', 1, 1),
(5, 'Dolorem eum non quis officiis iusto.', 'Excepteur sint occaecat cupidatat non proident, sunt in culpa.', 2, 1),
(6, 'Dolorem unde et officiis.', 'Qui officia deserunt mollitia animi, id est laborum et dolorum fuga.', 2, 1);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
