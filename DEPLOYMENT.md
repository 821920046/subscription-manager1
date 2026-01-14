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

#### 1. 创建 Cloudflare API Token

为了让 GitHub Actions 有权部署到您的账户，您需要创建一个具有特定权限的 Token：

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  点击右上角的 **个人资料图标 (Profile)** -> **我的设置 (My Profile)**。
3.  在左侧菜单点击 **API 令牌 (API Tokens)**。
4.  点击 **创建令牌 (Create Token)**。
5.  在“API 令牌模板”中，点击 **使用模板 (Use template)** 旁边的 **编辑 Cloudflare Workers (Edit Cloudflare Workers)**。
6.  **配置权限**（通常模板已默认选好，请确保包含以下内容）：
    *   **账户 (Account)** - **Workers 脚本 (Workers Scripts)** - **编辑 (Edit)**
    *   **账户 (Account)** - **Workers KV 存储 (Workers KV Storage)** - **编辑 (Edit)**
    *   **用户 (User)** - **成员资格 (Memberships)** - **读取 (Read)**
    *   **用户 (User)** - **用户详细信息 (User Details)** - **读取 (Read)**
7.  在 **账户资源 (Account Resources)** 中选择 **所有账户 (All accounts)** 或者您的特定账户。
8.  点击 **继续以显示摘要 (Continue to summary)** -> **创建令牌 (Create Token)**。
9.  **立即复制并保存该令牌**（它只会出现一次）。

#### 2. 配置 GitHub Secrets

1.  在 GitHub 仓库中，进入 **Settings** -> **Secrets and variables** -> **Actions**。
2.  新建以下 **Repository secrets**:
    *   `CLOUDFLARE_API_TOKEN`: 填入您刚刚生成的 Token。
    *   `CLOUDFLARE_ACCOUNT_ID`: 您的 Cloudflare 账户 ID（在 Dashboard 的 Workers 页面右侧可以看到）。
    *   `CF_KV_ID` (可选): 如果您不想在代码里写 KV ID，可以在这里设置。

#### 3. 触发部署

推送代码到 `master` 或 `main` 分支。
*   **注意**：默认需要 commit message 包含 `[deploy-prod]` 才会触发生产环境部署。

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
