# Cloudflare Workers 部署指南

本指南将指导您如何将 `subscription-manager` 部署到 Cloudflare Workers。

## 1. 准备工作

*   **Cloudflare 账号**：如果您还没有，请在 [Cloudflare](https://dash.cloudflare.com/sign-up) 注册。
*   **Node.js 环境**：确保您的本地环境已安装 Node.js (推荐版本 18.x 或 20.x)。
*   **Wrangler CLI**：本项目使用 Wrangler 进行开发和部署。

## 2. 配置 KV 存储 (必选)

本项目使用 Cloudflare KV 来存储订阅数据和配置。

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> **KV**。
3.  点击 **Create a namespace**。
4.  命名为 `SUBSCRIPTIONS_KV` (或者您喜欢的名字)。
5.  **记录下生成的 ID**，稍后需要用到。

## 3. 修改配置文件

打开项目根目录下的 `wrangler.toml` 文件：

```toml
name = "subscription-manager"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[[env.production.kv_namespaces]]
binding = "SUBSCRIPTIONS_KV"
id = "您的_KV_NAMESPACE_ID"  # 在这里填入您在第2步中获得的ID
```

## 4. 部署方式

### 方式 A：通过 GitHub Actions 自动化部署 (推荐)

本项目已配置 GitHub Actions 脚本。

1.  在 GitHub 仓库中，进入 **Settings** -> **Secrets and variables** -> **Actions**。
2.  新建以下 **Repository secrets**:
    *   `CLOUDFLARE_API_TOKEN`: 您的 Cloudflare API Token (需要有编辑 Workers 的权限)。
    *   `CLOUDFLARE_ACCOUNT_ID`: 您的 Cloudflare 账户 ID (在 Dashboard 的 Workers 页面右侧可以看到)。
    *   `CF_KV_ID` (可选): 如果您不想在代码里写 KV ID，可以在这里设置，CI 脚本会自动注入。
3.  推送代码到 `master` 或 `main` 分支，部署将自动开始。
    *   **注意**：默认需要 commit message 包含 `[deploy-prod]` 才会触发生产环境部署（取决于 `.github/workflows/deploy.yml` 的配置）。

### 方式 B：本地手动部署

1.  安装依赖：
    ```bash
    npm install
    ```
2.  登录 Cloudflare：
    ```bash
    npx wrangler login
    ```
3.  执行部署命令：
    ```bash
    npm run deploy:production
    ```

## 5. 初始配置

部署成功后，首次访问您的 Worker 域名。系统会自动生成一个随机的 `JWT_SECRET`。

*   **管理员账号**：默认管理员账号通常在 `src/utils/config.ts` 或环境变量中定义。
*   **安全建议**：部署后请立即进入设置页面修改管理员密码。

## 6. 常见问题

*   **部署失败 (Lint Error)**：项目开启了严格的类型检查。如果 CI 报错，请先执行 `npm run validate` 检查本地代码是否通过。
*   **KV 绑定错误**：确保 `wrangler.toml` 中的 `binding` 名称与代码中使用的名称一致 (默认为 `SUBSCRIPTIONS_KV`)。
