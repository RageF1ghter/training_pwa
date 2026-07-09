# FitLog

一款中文界面的健身训练记录 PWA（React 18 + TypeScript + Vite + Tailwind CSS 3），针对 iPhone 独立模式优化——包含安全区适配、竖屏锁定、430px 最大宽度的手机外框。没有路由、没有状态库、没有后端：所有数据都存储在本地设备上。

## 技术栈

- **React 18** + **TypeScript** —— 全部状态使用 `useState`，通过 props 向下传递
- **Vite 5** —— 构建、开发服务器、`__APP_VERSION__` 注入
- **Tailwind CSS 3** —— 由 CSS 自定义属性驱动的语义化主题 token
- **ECharts 6** —— 单动作的重量/休息折线图
- **@dnd-kit** —— 动作拖拽排序
- **lucide-react** —— 图标
- **JSZip** —— 本地数据备份导出/导入

## 命令

```
npm run dev      # 在 0.0.0.0 启动开发服务器
npm run build    # TypeScript 检查 (tsc -b) 后执行 Vite 生产构建
npm run preview  # 在 0.0.0.0 预览生产构建
```

## 应用结构

这是一个单页应用，底部固定的导航栏在四个标签页之间切换。`src/App.tsx` 是根组件：它持有**全部**状态和回调，并以 props 的方式向下传递——没有 Context、没有 Store、也没有路由。

```
src/
  App.tsx                          # 根组件 —— 所有状态、持久化副作用、回调、导出/导入
  main.tsx                         # 挂载 App；生产环境注册 SW，开发环境注销 SW
  types.ts                         # 所有共享的 TypeScript 类型
  styles.css                       # Tailwind + CSS 自定义属性 + 毛玻璃工具类
  data/exercises.ts                # 8 个锻炼部位，预设动作（每个 6-7 个）
  factories/workout.ts             # createBlankWorkout() 工厂函数
  utils/
    id.ts                          # makeId() —— crypto.randomUUID，带 Math.random 回退
    date.ts                        # 日期 key 格式化、周/月计算、星期标签
    workouts.ts                    # 聚合辅助函数 + 图表数据
  storage/
    workoutStorage.ts              # localStorage 读写 + 旧版数据迁移
    customExerciseStorage.ts       # 自定义/隐藏动作的增删改查 + 排序持久化
    photoStorage.ts                # 照片的 IndexedDB 增删改查
  components/
    TabButton.tsx                  # 底部导航标签按钮
    Stat.tsx                       # 数据展示磁贴（标签 + 数值）
    WorkoutList.tsx                # 已保存训练的只读（或可删除）列表
    ExercisePieChart.tsx           # 自定义 SVG 环形图 —— 某天的单动作次数分布
    BodyPartPieChart.tsx           # 自定义 SVG 环形图 —— 全历史的部位次数分布
    ExerciseLineChart.tsx          # ECharts 折线图 —— 本次 vs 上次重量 + 休息间歇
  views/
    RecordView.tsx                 # 草稿训练构建器、单组编辑、动作管理
    CalendarView.tsx               # 周/月日历，支持日期选择
    PhotoView.tsx                  # 照片上传、相册、训练部位标签
    SettingsView.tsx               # 主题切换 + ZIP/JSON 导出 & 导入
public/
  sw.js                            # Service Worker（导航请求网络优先，静态资源缓存优先）
  manifest.webmanifest             # PWA 清单（独立模式、竖屏、深色主题）
  icons/                           # 应用图标（180px、512px PNG + logo）
```

### 标签页

- **记录** —— 构建当前训练：选择部位 + 动作，运行单组计时器（开始 → 完成 → 添加本组），从下拉框选择重量/次数。已添加的组显示在 `DraftWorkoutSummary` 中，每组都可以内联编辑或删除。长按（650ms）或右键点击动作可进入编辑模式（拖拽排序、删除徽标）。添加本组后界面切换到休息计时器（"休息中"）。保存时会先弹出卡路里输入对话框再进行持久化。
- **日历** —— 周或月视图网格。每一天显示珊瑚色（训练）/ 海洋色（照片）圆点。顶部显示当前可见范围的周期统计（组数、千卡）。环形图会展示选中日期的单动作次数分布（`ExercisePieChart`），若当天无训练则改为展示全历史部位分布（`BodyPartPieChart`）。点击饼图扇区会打开 `ExerciseLineChart`，将本次训练每组的重量与上次训练对比，并显示休息间歇。
- **照片** —— 为选中日期上传照片（base64，存储在 IndexedDB），双列相册带删除按钮，相册上方显示训练部位标签。
- **设置** —— 浅色/深色主题切换，以及数据备份（导出全部或按日期导出，导入 ZIP 或 JSON）。

## 数据模型

定义在 `src/types.ts`：

```
Workout ──▶ WorkoutExercise[] ──▶ WorkoutSet[]
```

- **`Workout`** —— `{ id, date, exercises[], calories, createdAt, startedAt? }`
- **`WorkoutExercise`** —— `{ id, bodyPart, exercise, sets[] }`
- **`WorkoutSet`** —— `{ id, weight, reps, durationSeconds, startedAt?, finishedAt? }` —— 可选的 Unix 毫秒时间戳用于计算休息间歇。
- **`DayPhoto`** —— `{ id, date, dataUrl(base64), createdAt }`
- **`BodyPart`** —— 8 个中文字符串的联合类型（胸部/背部/腿部/肩部/手臂/核心/有氧/全身）
- 辅助映射全部为 `Record<BodyPart, string[]>`：`CustomExerciseMap`、`HiddenExerciseMap`、`ExerciseOrderMap`

## 存储逻辑

### 各数据的存储位置

| 数据 | 位置 | Key / store | 写入方 |
|------|------|-------------|--------|
| 训练记录 | `localStorage` | `fitlog.workouts` | `storage/workoutStorage.ts` |
| 自定义动作 | `localStorage` | `fitlog.customExercises` | `storage/customExerciseStorage.ts` |
| 隐藏的预设动作 | `localStorage` | `fitlog.hiddenExercises` | `storage/customExerciseStorage.ts` |
| 动作排序 | `localStorage` | `fitlog.exerciseOrder` | `storage/customExerciseStorage.ts` |
| 主题 | `localStorage` | `fitlog.theme`（`"light"` / `"dark"`） | `App.tsx` 主题副作用 |
| 日历模式 | `localStorage` | `fitlog.calendarMode`（`"week"` / `"month"`） | `App.tsx` 模式副作用 |
| 照片 | **IndexedDB** | 数据库 `fitlog.photos`，对象仓库 `photos`（主键 = `id`，索引 = `date`） | `storage/photoStorage.ts` |

### 持久化流程

所有状态都通过 `App.tsx:33-69` 中的 `useState(() => readX())` 惰性初始化自存储。每一份需要持久化的状态都有一个对应的 `useEffect`（`App.tsx:71-131`），在数据变化时写回存储——应用数据**没有**显式的"保存"调用，只有这些变更即写入的副作用：

```
workouts        ──▶ writeWorkouts()         ──▶ localStorage["fitlog.workouts"]
customExercises ──▶ writeCustomExercises()  ──▶ localStorage["fitlog.customExercises"]
hiddenExercises ──▶ writeHiddenExercises()  ──▶ localStorage["fitlog.hiddenExercises"]
exerciseOrder   ──▶ writeExerciseOrder()    ──▶ localStorage["fitlog.exerciseOrder"]
isLightTheme    ──▶ setItem("fitlog.theme") + 切换 html.light 类名
calendarMode    ──▶ setItem("fitlog.calendarMode")
```

照片在挂载时一次性加载（`getPhotos()` → `setPhotos(...)`，`App.tsx:100-104`），之后每次上传/删除都通过 `savePhoto` / `removePhoto` 写入，同时并行更新内存中的数组。

### 读取时的数据规范化

每个读取函数都会对存储数据进行规范化/修复，因此损坏或被手动编辑过的数据不会导致应用崩溃：

- **`readWorkouts`** 会把每条记录过一遍 `normalizeWorkout`，它同时接受**当前的多动作格式**和**旧版单动作格式**（`bodyPart`/`exercise`/`sets` 位于 workout 层级），将数字强制转为 `>= 0`，补齐缺失的 `id`/`createdAt`，并丢弃任何无效项。
- **`readCustomExercises` / `readHiddenExercises` / `readExerciseOrder`** 会去除首尾空格、去重，并过滤无效项（例如不属于真实预设的隐藏项会被丢弃）。

### 动作可见性

某个部位的可见动作列表按如下方式计算：
`presets.filter(未被隐藏).concat(自定义)`，然后按已保存的 `exerciseOrder` 排序（未知的/新增的动作追加到末尾）。删除预设动作会将其**隐藏**；删除自定义动作会将其**永久移除**。

### 备份导出 / 导入（`App.tsx:392-470`）

- **导出** 将 `{ version, exportedAt, appVersion, workouts, customExercises, hiddenExercises, exerciseOrder, photos }` 打包进 `data.json`，用 JSZip 压缩后下载为 `fitlog-backup-YYYY-MM-DD.zip`。支持导出全部数据，或手动勾选部分日期导出。
- **导入** 接受 `.zip`（读取内部的 `data.json`）或原始 `.json`。在校验 `version` / `workouts` / `photos` 之后，按**日期**合并：对于备份中存在的任一日期，该日期下既有的训练和照片会被移除并被导入数据替换。动作配置（自定义/隐藏/排序）会被整体覆盖。合并过程中照片会从 IndexedDB 物理删除/写入。

### ID 生成

`utils/id.ts` —— `makeId()` 优先使用 `crypto.randomUUID()`，并提供 `Math.random` 回退，因为 `crypto.randomUUID` 在非安全（HTTP）上下文中不可用。
