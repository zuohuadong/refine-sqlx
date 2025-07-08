# Documentation Index

Welcome to the refine-sql and refine-orm documentation! This project provides multi-runtime SQL data providers for the Refine framework, supporting Cloudflare D1, Node.js SQLite, and Bun SQLite.

## Packages

### refine-sql (Core Package)
The core SQL data provider with flexible query support and multi-runtime compatibility.

### refine-orm (ORM Extension)
Drizzle ORM integration with type-safe queries and multi-runtime support.

## Documentation Languages

### English Documentation

- [**refine-sql Documentation**](./en/refine-sql.md)
  - Complete guide for the core SQL package
  - Installation and setup for all runtimes
  - CRUD operations and custom queries
  - Advanced filtering and sorting
  - Performance optimization

- [**refine-orm Documentation**](./en/refine-orm.md)
  - Complete guide for the ORM extension
  - Drizzle schema definition and setup
  - Type-safe queries and relationships
  - Multi-runtime configuration
  - Migration from refine-sql

### 中文文档

- [**refine-sql 文档**](./zh-cn/refine-sql.md)
  - 核心 SQL 包完整指南
  - 所有运行时的安装和设置
  - CRUD 操作和自定义查询
  - 高级过滤和排序
  - 性能优化

- [**refine-orm 文档**](./zh-cn/refine-orm.md)
  - ORM 扩展完整指南
  - Drizzle 模式定义和设置
  - 类型安全查询和关系
  - 多运行时配置
  - 从 refine-sql 迁移

## Quick Navigation

### Getting Started
- Choose **refine-sql** for direct SQL control with custom query flexibility
- Choose **refine-orm** for type-safe ORM features with Drizzle integration

### Runtime Support
- **Cloudflare D1**: Edge computing with global distribution
- **Node.js SQLite**: Traditional server applications with better-sqlite3
- **Bun SQLite**: High-performance JavaScript runtime with built-in SQLite

### Key Features
- Multi-runtime support with automatic detection
- Complete CRUD operations
- Custom query support (SQL and ORM)
- Type safety and parameter conversion
- Performance optimizations

### Examples
Check the `/examples` directory in the project root for complete working examples:
- Cloudflare Worker implementation
- Node.js application setup
- Bun application configuration
- Universal/isomorphic usage patterns

## Additional Resources

- [Project README](../README.md) - Overview and quick start
- [Usage Guide](../USAGE-GUIDE.md) - Detailed usage patterns
- [Deployment Guide](../DEPLOYMENT.md) - Production deployment
- [Cloudflare D1 Guide](../CLOUDFLARE.md) - D1-specific features
- [Examples Directory](../examples/) - Working code examples

## Community and Support

- [GitHub Issues](https://github.com/zuohuadong/refine-sql/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/zuohuadong/refine-sql/discussions) - Community discussions
- [Refine Documentation](https://refine.dev/docs/) - Framework documentation
- [Drizzle ORM Documentation](https://orm.drizzle.team/) - ORM documentation

## Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details on:
- Code style and standards
- Testing requirements
- Pull request process
- Development setup

## License

This project is licensed under the MIT License - see the [LICENSE.md](../LICENSE.md) file for details.
