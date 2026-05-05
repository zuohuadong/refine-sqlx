/**
 * refine-sql createProvider() 使用示例
 * 展示新的统一工厂函数的各种用法
 */

import { createProvider } from '../src/index';
import type { TableSchema } from '../src/typed-methods';

// 定义类型安全的表结构
interface BlogSchema extends TableSchema {
    users: {
        id: number;
        name: string;
        email: string;
        created_at: string;
    };
    posts: {
        id: number;
        title: string;
        content: string;
        user_id: number;
        status: 'draft' | 'published';
        created_at: string;
    };
}

async function main() {
    console.log('🚀 refine-sql createProvider() 示例');

    // 1. 基础用法 - 文件数据库
    console.log('\n1. 基础用法 - 文件数据库');
    const fileProvider = createProvider<BlogSchema>('./blog.db');
    console.log('✅ 文件数据库提供器创建成功');

    // 2. 内存数据库
    console.log('\n2. 内存数据库');
    const memoryProvider = createProvider<BlogSchema>(':memory:');
    console.log('✅ 内存数据库提供器创建成功');

    // 3. 配置对象方式 - 基础配置
    console.log('\n3. 配置对象方式 - 基础配置');
    const configProvider = createProvider<BlogSchema>({
        connection: './blog-config.db',
        options: {
            debug: true,
            timeout: 5000
        }
    });
    console.log('✅ 配置对象提供器创建成功');

    // 4. 配置对象方式 - 高级选项
    console.log('\n4. 配置对象方式 - 高级选项');
    const optionsProvider = createProvider<BlogSchema>({
        connection: './blog-options.db',
        options: {
            debug: false,
            timeout: 10000
        }
    });
    console.log('✅ 高级选项提供器创建成功');

    // 5. Cloudflare D1 配置
    console.log('\n5. Cloudflare D1 配置');
    // 注意：这里只是示例，实际使用时需要真实的 D1 数据库实例
    const d1Provider = createProvider<BlogSchema>({
        connection: { d1Database: null }, // 实际使用时传入 env.DB
        options: {
            debug: true
        }
    });
    console.log('✅ D1 提供器创建成功');

    // 6. 使用提供器进行基础操作
    console.log('\n6. 基础 CRUD 操作示例');

    try {
        // 创建用户
        const user = await memoryProvider.create({
            resource: 'users',
            variables: {
                name: 'John Doe',
                email: 'john@example.com'
            }
        });
        console.log('✅ 用户创建成功:', user.data);

        // 获取用户列表
        const users = await memoryProvider.getList({
            resource: 'users',
            pagination: { currentPage: 1, pageSize: 10, mode: 'server' }
        });
        console.log('✅ 用户列表获取成功:', users.data.length, '条记录');

        // 链式查询
        const activeUsers = await memoryProvider
            .from('users')
            .where('email', 'contains', '@example.com')
            .orderBy('created_at', 'desc')
            .limit(5)
            .get();
        console.log('✅ 链式查询成功:', activeUsers.length, '条记录');

    } catch (error) {
        console.log('ℹ️  数据库操作示例（需要实际表结构）');
    }

    // 7. 演示不同提供器的使用
    console.log('\n7. 提供器功能演示');
    console.log('✅ 文件数据库提供器:', typeof fileProvider);
    console.log('✅ 配置对象提供器:', typeof configProvider);
    console.log('✅ 高级选项提供器:', typeof optionsProvider);
    console.log('✅ D1 提供器:', typeof d1Provider);

    // 8. 验证所有提供器都正确创建
    console.log('\n8. 提供器验证');
    const providers = [fileProvider, memoryProvider, configProvider, optionsProvider, d1Provider];
    providers.forEach((provider, index) => {
        console.log(`✅ 提供器 ${index + 1}: ${provider ? '创建成功' : '创建失败'}`);
    });

    console.log('\n🎉 所有示例运行完成！');
}

// 运行示例
if (require.main === module) {
    main().catch(console.error);
}

export { main };