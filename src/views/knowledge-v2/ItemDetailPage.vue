<template>
  <n-spin :show="pageLoading" description="加载中...">
    <div class="item-detail-page">
      <!-- Breadcrumb -->
      <n-breadcrumb class="breadcrumb">
        <n-breadcrumb-item class="breadcrumb-clickable" @click="$router.push('/knowledge-v2/list')">知识库</n-breadcrumb-item>
        <n-breadcrumb-item class="breadcrumb-clickable" @click="$router.push(`/knowledge-v2/${kid}`)">{{ kbName }}</n-breadcrumb-item>
        <n-breadcrumb-item class="breadcrumb-clickable" @click="$router.push(`/knowledge-v2/${kid}?tab=items`)">条目</n-breadcrumb-item>
        <n-breadcrumb-item>{{ form.title || '未命名条目' }}</n-breadcrumb-item>
      </n-breadcrumb>

      <!-- 元数据（状态、创建/更新时间、作者） -->
      <div v-if="form.status || itemMeta.createdAt || itemMeta.updatedAt" class="item-meta-bar">
        <n-text depth="3" style="font-size: 12px">
          <template v-if="form.status">
            <n-tag size="small" :type="form.status === 'published' ? 'success' : form.status === 'archived' ? 'default' : 'info'">
              {{ form.status === 'draft' ? '草稿' : form.status === 'published' ? '已发布' : '已归档' }}
            </n-tag>
            <span v-if="itemMeta.createdAt || itemMeta.updatedAt" style="margin-left: 8px;">·</span>
          </template>
          <template v-if="itemMeta.createdAt">创建：{{ formatMetaTime(itemMeta.createdAt) }}</template>
          <template v-if="itemMeta.updatedAt">
            <span v-if="itemMeta.createdAt"> · </span>
            更新：{{ formatMetaTime(itemMeta.updatedAt) }}
          </template>
          <template v-if="itemMeta.author">
            <span v-if="itemMeta.createdAt || itemMeta.updatedAt"> · </span>
            {{ itemMeta.author }}
          </template>
        </n-text>
      </div>

      <!-- Two-column layout -->
      <div class="main-columns">
        <!-- LEFT COLUMN: Edit Form -->
        <div class="left-col">
          <!-- Basic Info -->
          <n-card title="基本信息" size="small" class="form-card">
            <n-form label-placement="top">
              <n-form-item label="标题" required>
                <n-input v-model:value="form.title" placeholder="请输入条目标题" maxlength="200" show-count clearable />
              </n-form-item>
              <n-form-item label="摘要">
                <n-input v-model:value="form.summary" type="textarea" :rows="3" placeholder="请输入摘要" maxlength="1000" show-count />
              </n-form-item>
            </n-form>
          </n-card>

          <!-- Security Info -->
          <n-card title="安全信息" size="small" class="form-card">
            <n-form label-placement="top">
              <n-form-item label="漏洞类型">
                <n-space :size="8" wrap align="center">
                  <n-tag
                    v-for="cweId in form.cweIds"
                    :key="cweId"
                    closable
                    @close="removeCwe(cweId)"
                  >
                    {{ getCweDisplayName(cweId) }}
                  </n-tag>
                  <n-button size="small" @click="showCweSelector = true">
                    {{ form.cweIds.length ? '更换' : '选择 CWE' }}
                  </n-button>
                </n-space>
                <CweSelector
                  v-model="showCweSelector"
                  :selected-values="form.cweIds"
                  @confirm="handleCweConfirm"
                />
              </n-form-item>
              <div class="risk-dimensions-hint">选择以下维度，系统依据 CVSS v4.0 标准自动评估和存储风险等级</div>
              <n-grid :cols="24" :x-gap="16" :y-gap="16" style="margin-top: 8px;">
                <n-gi :span="12">
                  <n-form-item label="攻击方式" required>
                    <n-select
                      v-model:value="form.riskAttackVector"
                      :options="riskAttackVectorOptions"
                      placeholder="选择攻击方式"
                      clearable
                    >
                      <template #option="{ label, description }">
                        <div class="select-option"><div class="option-label">{{ label }}</div><div class="option-desc">{{ description }}</div></div>
                      </template>
                    </n-select>
                  </n-form-item>
                </n-gi>
                <n-gi :span="12">
                  <n-form-item label="利用复杂度" required>
                    <n-select
                      v-model:value="form.riskComplexity"
                      :options="riskComplexityOptions"
                      placeholder="选择利用复杂度"
                      clearable
                    >
                      <template #option="{ label, description }">
                        <div class="select-option"><div class="option-label">{{ label }}</div><div class="option-desc">{{ description }}</div></div>
                      </template>
                    </n-select>
                  </n-form-item>
                </n-gi>
                <n-gi :span="12">
                  <n-form-item label="权限需求" required>
                    <n-select
                      v-model:value="form.riskPrivileges"
                      :options="riskPrivilegesOptions"
                      placeholder="选择权限需求"
                      clearable
                    >
                      <template #option="{ label, description }">
                        <div class="select-option"><div class="option-label">{{ label }}</div><div class="option-desc">{{ description }}</div></div>
                      </template>
                    </n-select>
                  </n-form-item>
                </n-gi>
                <n-gi :span="12">
                  <n-form-item label="用户交互" required>
                    <n-select
                      v-model:value="form.riskUserInteraction"
                      :options="riskUserInteractionOptions"
                      placeholder="选择用户交互需求"
                      clearable
                    >
                      <template #option="{ label, description }">
                        <div class="select-option"><div class="option-label">{{ label }}</div><div class="option-desc">{{ description }}</div></div>
                      </template>
                    </n-select>
                  </n-form-item>
                </n-gi>
                <n-gi :span="24">
                  <n-form-item label="影响范围" required>
                    <n-select
                      v-model:value="form.riskImpact"
                      :options="riskImpactOptions"
                      placeholder="选择影响范围（可多选）"
                      multiple
                      clearable
                    >
                      <template #option="{ label, description }">
                        <div class="select-option"><div class="option-label">{{ label }}</div><div class="option-desc">{{ description }}</div></div>
                      </template>
                    </n-select>
                  </n-form-item>
                </n-gi>
              </n-grid>
              <n-form-item v-if="calculatedRiskScore" label="风险评估">
                <RiskScoreCard
                  :score="calculatedRiskScore.exact ?? undefined"
                  :score-range="calculatedRiskScore.exact == null && calculatedRiskScore.min != null && calculatedRiskScore.max != null ? { min: calculatedRiskScore.min, max: calculatedRiskScore.max } : undefined"
                  :risk-level="calculatedRiskLevel ?? undefined"
                  :show-details="true"
                />
              </n-form-item>
            </n-form>
          </n-card>

          <!-- Content -->
          <n-card title="内容详情" size="small" class="form-card">
            <n-form label-placement="top">
              <n-form-item label="问题描述">
                <n-input v-model:value="form.description" type="textarea" :rows="6" placeholder="请描述安全问题" maxlength="5000" show-count />
              </n-form-item>
              <n-form-item label="修复方案">
                <n-input v-model:value="form.solution" type="textarea" :rows="6" placeholder="请描述修复方案" maxlength="5000" show-count />
              </n-form-item>
              <n-form-item label="示例代码">
                <CodeEditor v-model="form.exampleCode" />
              </n-form-item>
              <n-form-item label="编程语言">
                <n-select
                  v-model:value="form.language"
                  :options="languageOptions"
                  clearable
                  filterable
                  placeholder="选择编程语言"
                />
              </n-form-item>
              <n-form-item label="参考链接">
                <n-input v-model:value="form.references" type="textarea" :rows="3" placeholder="每行一个链接" maxlength="2000" show-count />
              </n-form-item>
            </n-form>
          </n-card>

          <!-- Tags -->
          <n-card title="标签" size="small" class="form-card">
            <TagPicker
              v-model="form.tags"
              :system-tags="systemTags"
              :user-tags="userTags"
              placeholder="点击选择标签"
              @create="handleTagCreate"
            />
          </n-card>
        </div>

        <!-- RIGHT COLUMN: Fragment Panel -->
        <div class="right-col">
          <n-card size="small" class="form-card">
            <template #header>
              <div class="fragment-header">
                <span>关联片段</span>
                <n-tag size="small" round type="info">{{ fragments.length }}</n-tag>
              </div>
            </template>
            <template #header-extra>
              <n-button size="small" type="primary" @click="showFragmentDialog = true">编辑关联片段</n-button>
            </template>

            <n-spin :show="fragmentsLoading">
              <div v-if="fragments.length === 0 && !fragmentsLoading" class="empty-state">
                <n-empty description="暂无关联片段，点击上方按钮添加" />
              </div>
              <n-scrollbar v-else style="max-height: 600px">
                <div v-for="frag in fragments" :key="frag.id ?? frag.fragmentId" class="fragment-card">
                  <div class="fragment-content" @click="toggleFragment(String(frag.id ?? frag.fragmentId))">
                    <template v-if="expandedFragments.has(String(frag.id ?? frag.fragmentId))">
                      {{ frag.content }}
                    </template>
                    <template v-else>
                      <n-ellipsis :line-clamp="3" :tooltip="false">{{ frag.content }}</n-ellipsis>
                    </template>
                  </div>
                  <div class="fragment-meta">
                    <n-text depth="3" style="font-size: 12px">{{ frag.documentName ?? frag.sourceName ?? '未知来源' }}</n-text>
                    <n-space size="small">
                      <n-tag v-if="frag.associationType === 'manual' || frag.associationType === '人工'" size="tiny" type="info">人工</n-tag>
                      <n-tag v-else size="tiny" type="success">
                        AI
                        <template v-if="frag.relevanceScore"> · {{ frag.relevanceScore }}</template>
                      </n-tag>
                      <n-popconfirm @positive-click="removeFragment(String(frag.id ?? frag.fragmentId))">
                        <template #trigger>
                          <n-button size="tiny" type="error" quaternary>移除关联</n-button>
                        </template>
                        确定取消此片段的关联？
                      </n-popconfirm>
                    </n-space>
                  </div>
                </div>
              </n-scrollbar>
            </n-spin>
          </n-card>
        </div>
      </div>

      <!-- BOTTOM: Version History Center（暂时隐藏） -->
      <div v-if="false" class="version-section">
        <n-card size="small" class="form-card">
          <template #header>
            <n-space align="center" :size="8">
              <span style="font-weight:600">版本历史</span>
              <n-tag v-if="versionHistory.length > 0" size="small" :bordered="false" type="info">
                {{ versionHistory.length }} 个版本
              </n-tag>
            </n-space>
          </template>
          <template #header-extra>
            <n-button size="tiny" quaternary @click="loadVersionHistory" :loading="versionLoading">
              <template #icon><SvgIcon icon="mdi:refresh" style="font-size:14px" /></template>
            </n-button>
          </template>
          <n-spin :show="versionLoading">
            <n-empty v-if="versionHistory.length === 0 && !versionLoading" description="暂无版本历史" />
            <n-timeline v-else>
              <n-timeline-item
                v-for="(entry, idx) in versionHistory"
                :key="entry.id"
                :type="entry.changeType === 'restore' ? 'warning' : entry.changeType === 'pre_restore' ? 'info' : idx === 0 ? 'success' : 'default'"
              >
                <template #header>
                  <n-space align="center" :size="6">
                    <span style="font-weight:600; font-size:13px">v{{ entry.version ?? entry.id }}</span>
                    <n-tag
                      v-if="entry.changeType"
                      size="small"
                      :bordered="false"
                      :type="changeTypeBadge(entry.changeType).type"
                    >{{ changeTypeBadge(entry.changeType).label }}</n-tag>
                    <n-tag v-if="idx === 0" size="small" :bordered="false" type="success">当前</n-tag>
                  </n-space>
                </template>
                <template #default>
                  <div style="font-size:12px; color:#605e5c; line-height:1.6">
                    <div v-if="entry.changeReason || entry.changeDescription">
                      {{ entry.changeReason || entry.changeDescription }}
                    </div>
                    <div>
                      <span>{{ entry.changedByName ?? entry.author ?? '系统' }}</span>
                      <span style="margin-left:8px; color:#a19f9d">{{ formatVersionTime(entry.changedAt ?? entry.timestamp ?? entry.createdAt) }}</span>
                    </div>
                  </div>
                </template>
                <template #footer>
                  <n-space size="small">
                    <n-button size="tiny" quaternary type="info" @click="viewVersion(entry)">
                      <template #icon><SvgIcon icon="mdi:eye-outline" style="font-size:13px" /></template>
                      查看
                    </n-button>
                    <n-button
                      v-if="idx > 0"
                      size="tiny" quaternary type="primary"
                      @click="openDiffModal(versionHistory[idx - 1], entry)"
                    >
                      <template #icon><SvgIcon icon="mdi:compare" style="font-size:13px" /></template>
                      对比上一版
                    </n-button>
                    <n-button
                      v-if="idx !== 0"
                      size="tiny" quaternary type="warning"
                      @click="openRestoreDialog(entry)"
                    >
                      <template #icon><SvgIcon icon="mdi:history" style="font-size:13px" /></template>
                      恢复
                    </n-button>
                  </n-space>
                </template>
              </n-timeline-item>
            </n-timeline>
          </n-spin>
        </n-card>
      </div>

      <!-- Sticky Action Bar（Ctrl+S 保存） -->
      <div class="action-bar" :class="{ 'action-bar--saved': saveSuccessFlash }">
        <n-space align="center">
          <n-alert v-if="isDirty" type="warning" :bordered="false" style="padding: 4px 12px">
            未保存的更改
          </n-alert>
        </n-space>
        <n-space>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button :loading="saving" :disabled="!canSave || !isDirty" @click="saveItem('draft')">保存草稿</n-button>
            </template>
            Ctrl+S 快速保存
          </n-tooltip>
          <n-button type="primary" :loading="saving" :disabled="!canSave" @click="saveItem('published')">发布</n-button>
          <n-button type="warning" :loading="saving" :disabled="!canSave" @click="handleArchive">归档</n-button>
          <n-popconfirm @positive-click="handleDelete">
            <template #trigger>
              <n-button type="error" :loading="deleting">删除</n-button>
            </template>
            确定删除条目「{{ form.title }}」？此操作不可恢复。
          </n-popconfirm>
        </n-space>
      </div>

      <!-- Fragment Selector -->
      <FragmentSelector
        v-model="showFragmentDialog"
        :kid="kid"
        :item-uuid="uuid"
        title="选择并关联片段"
        @select="handleFragmentSelect"
        @associate="handleFragmentBatchAssociate"
        @disassociate="handleFragmentBatchDisassociate"
      />

      <!-- Version Snapshot Dialog（暂时隐藏） -->
      <n-modal v-if="false" v-model:show="showVersionModal" preset="card" style="width: 780px; max-width: 92vw">
        <template #header>
          <div class="version-snapshot-header">
            <n-space align="center" :size="8">
              <span class="version-snapshot-title">
                版本快照 v{{ versionSnapshotData?.version ?? versionSnapshotData?.id ?? '—' }}
              </span>
              <n-tag
                v-if="versionSnapshotData?.changeType"
                size="small"
                :bordered="false"
                :type="changeTypeBadge(versionSnapshotData.changeType).type"
              >
                {{ changeTypeBadge(versionSnapshotData.changeType).label }}
              </n-tag>
              <n-tag
                v-if="versionSnapshotData?.isCurrent === '1'"
                size="small"
                :bordered="false"
                type="success"
              >
                当前
              </n-tag>
            </n-space>
            <n-space align="center" :size="8">
              <span class="version-snapshot-meta" v-if="versionSnapshotData">
                {{ versionSnapshotData.changedByName ?? '系统' }}
                <span style="margin: 0 4px;">·</span>
                {{ formatVersionTime(versionSnapshotData.changedAt) }}
              </span>
              <n-button text size="tiny" @click="showVersionJson = !showVersionJson">
                {{ showVersionJson ? '收起 JSON' : '查看原始 JSON' }}
              </n-button>
            </n-space>
          </div>
        </template>
        <n-scrollbar style="max-height: 540px">
          <n-space vertical :size="12">
            <n-alert
              v-if="versionSnapshotData?.changeReason"
              type="info"
              :bordered="false"
              class="version-snapshot-reason"
            >
              {{ versionSnapshotData.changeReason }}
            </n-alert>

            <n-card size="small" class="version-snapshot-section" title="条目信息">
              <n-descriptions
                v-if="versionSnapshotData"
                size="small"
                :column="2"
                label-placement="left"
                label-align="left"
              >
                <n-descriptions-item label="标题">
                  {{ versionSnapshotData.title || '（未填写）' }}
                </n-descriptions-item>
                <n-descriptions-item label="漏洞类型">
                  {{ versionSnapshotData.vulnerabilityType || '—' }}
                </n-descriptions-item>
                <n-descriptions-item label="语言">
                  {{ versionSnapshotData.language || '—' }}
                </n-descriptions-item>
                <n-descriptions-item label="风险等级">
                  {{ versionSnapshotData.severity || '—' }}
                </n-descriptions-item>
              </n-descriptions>
            </n-card>

            <n-card size="small" class="version-snapshot-section" title="内容概览">
              <div
                v-if="versionSnapshotData?.summary"
                class="version-snapshot-field"
              >
                <div class="version-snapshot-field__label">摘要</div>
                <n-ellipsis :line-clamp="3">
                  {{ versionSnapshotData.summary }}
                </n-ellipsis>
              </div>
              <div
                v-if="versionSnapshotData?.problemDescription"
                class="version-snapshot-field"
              >
                <div class="version-snapshot-field__label">问题描述</div>
                <n-ellipsis :line-clamp="4">
                  {{ versionSnapshotData.problemDescription }}
                </n-ellipsis>
              </div>
              <div
                v-if="versionSnapshotData?.fixSolution"
                class="version-snapshot-field"
              >
                <div class="version-snapshot-field__label">修复方案</div>
                <n-ellipsis :line-clamp="4">
                  {{ versionSnapshotData.fixSolution }}
                </n-ellipsis>
              </div>
              <div
                v-if="versionSnapshotData?.exampleCode"
                class="version-snapshot-field"
              >
                <div class="version-snapshot-field__label">示例代码</div>
                <n-ellipsis :line-clamp="6">
                  {{ versionSnapshotData.exampleCode }}
                </n-ellipsis>
              </div>
              <div
                v-if="!versionSnapshotData?.summary && !versionSnapshotData?.problemDescription && !versionSnapshotData?.fixSolution && !versionSnapshotData?.exampleCode"
                class="version-snapshot-empty"
              >
                暂无可展示的内容字段。
              </div>
            </n-card>

            <n-card
              v-if="showVersionJson && versionSnapshotJson"
              size="small"
              class="version-snapshot-section"
              title="原始 JSON（调试用）"
            >
              <pre class="version-snapshot-json">{{ versionSnapshotJson }}</pre>
            </n-card>
          </n-space>
        </n-scrollbar>
      </n-modal>

      <!-- Diff Modal（暂时隐藏） -->
      <n-modal v-if="false" v-model:show="showDiffModal" preset="card" style="width: 860px; max-width: 92vw">
        <template #header>
          <div class="diff-modal-header">
            <n-space align="center" :size="8">
              <SvgIcon icon="mdi:compare" style="font-size:18px; color:#0078d4" />
              <span>版本对比</span>
              <n-tag size="small" :bordered="false" type="info">
                v{{ diffResult?.fromVersion }} → v{{ diffResult?.toVersion }}
              </n-tag>
              <n-tag v-if="diffResult?.changedFieldCount" size="small" :bordered="false" type="warning">
                {{ diffResult.changedFieldCount }} 处变更
              </n-tag>
            </n-space>
            <n-space align="center" :size="8">
              <!-- Diff navigation -->
              <template v-if="changedDiffIndices.length > 0">
                <n-button size="tiny" quaternary @click="navigateDiff('prev')" :disabled="changedDiffIndices.length <= 1">
                  <template #icon><SvgIcon icon="mdi:chevron-up" style="font-size:14px" /></template>
                </n-button>
                <span style="font-size:11px; color:#605e5c; min-width:60px; text-align:center">
                  {{ currentDiffIndex >= 0 ? (changedDiffIndices.indexOf(currentDiffIndex) + 1) : '—' }} / {{ changedDiffIndices.length }}
                </span>
                <n-button size="tiny" quaternary @click="navigateDiff('next')" :disabled="changedDiffIndices.length <= 1">
                  <template #icon><SvgIcon icon="mdi:chevron-down" style="font-size:14px" /></template>
                </n-button>
              </template>
              <!-- View mode toggle -->
              <n-radio-group v-model:value="diffViewMode" size="small">
                <n-radio-button value="side-by-side">并排</n-radio-button>
                <n-radio-button value="inline">行内</n-radio-button>
              </n-radio-group>
            </n-space>
          </div>
        </template>
        <n-spin :show="diffLoading">
          <div v-if="diffResult" class="diff-viewer">
            <!-- Diff meta -->
            <div class="diff-meta">
              <div class="diff-meta__side">
                <n-tag size="small" type="error" :bordered="false">旧</n-tag>
                <span>v{{ diffResult.fromVersion }}</span>
                <span style="color:#a19f9d">{{ diffResult.fromChangedByName }}</span>
                <span style="color:#a19f9d; font-size:11px">{{ formatVersionTime(diffResult.fromChangedAt) }}</span>
              </div>
              <SvgIcon icon="mdi:arrow-right" style="font-size:16px; color:#a19f9d" />
              <div class="diff-meta__side">
                <n-tag size="small" type="success" :bordered="false">新</n-tag>
                <span>v{{ diffResult.toVersion }}</span>
                <span style="color:#a19f9d">{{ diffResult.toChangedByName }}</span>
                <span style="color:#a19f9d; font-size:11px">{{ formatVersionTime(diffResult.toChangedAt) }}</span>
              </div>
            </div>

            <!-- Diff fields -->
            <div
              v-for="(diff, idx) in diffResult.diffs"
              :key="diff.fieldName"
              :ref="(el: any) => setDiffFieldRef(el, idx)"
              class="diff-field"
              :class="{ 'diff-field--focused': currentDiffIndex === idx }"
            >
              <div class="diff-field__header">
                <span class="diff-field__label">{{ diff.fieldLabel }}</span>
                <n-tag
                  size="small"
                  :bordered="false"
                  :type="diffTypeTag(diff.diffType).type"
                >{{ diffTypeTag(diff.diffType).label }}</n-tag>
              </div>
              <div v-if="diff.diffType !== 'unchanged'" class="diff-field__body" :class="diffViewMode === 'inline' ? 'diff-field__body--inline' : 'diff-field__body--side'">
                <div v-if="diff.diffType === 'modified' || diff.diffType === 'removed'" class="diff-field__old">
                  <div class="diff-field__side-label">旧值</div>
                  <pre class="diff-field__content diff-field__content--old">{{ diff.oldValue || '（空）' }}</pre>
                </div>
                <div v-if="diff.diffType === 'modified' || diff.diffType === 'added'" class="diff-field__new">
                  <div class="diff-field__side-label">新值</div>
                  <pre class="diff-field__content diff-field__content--new">{{ diff.newValue || '（空）' }}</pre>
                </div>
              </div>
              <div v-else class="diff-field__unchanged">
                <span style="color:#a19f9d; font-size:12px">未变更</span>
              </div>
            </div>

            <n-empty v-if="diffResult.diffs?.length === 0" description="两个版本完全相同" style="padding:40px 0" />
          </div>
          <n-empty v-else-if="!diffLoading" description="无法加载对比数据" style="padding:40px 0" />
        </n-spin>
      </n-modal>

      <!-- Restore Dialog (two-step: preview → confirm) -->
      <n-modal v-model:show="showRestoreDialog" preset="card" style="width: 720px; max-width: 92vw">
        <template #header>
          <n-space align="center" :size="8">
            <SvgIcon icon="mdi:history" style="font-size:18px; color:#ca5010" />
            <span>恢复到 v{{ restoreTargetVersion }}</span>
            <n-tag size="small" :bordered="false" :type="restoreStep === 'preview' ? 'info' : 'warning'">
              {{ restoreStep === 'preview' ? '步骤 1：预览变更' : '步骤 2：确认恢复' }}
            </n-tag>
          </n-space>
        </template>

        <!-- Step 1: Preview diff -->
        <div v-if="restoreStep === 'preview'">
          <n-alert type="info" :bordered="false" style="margin-bottom: 12px">
            以下是恢复后将发生的变更。请仔细确认后再继续。
          </n-alert>
          <n-spin :show="restorePreviewLoading">
            <div v-if="restorePreviewDiff?.diffs?.length" class="restore-preview-list">
              <div
                v-for="diff in restorePreviewDiff.diffs.filter((d: any) => d.diffType !== 'unchanged')"
                :key="diff.fieldName"
                class="restore-preview-item"
              >
                <span class="restore-preview-item__label">{{ diff.fieldLabel }}</span>
                <n-tag size="small" :bordered="false" :type="diffTypeTag(diff.diffType).type">
                  {{ diffTypeTag(diff.diffType).label }}
                </n-tag>
                <span class="restore-preview-item__summary">
                  <template v-if="diff.diffType === 'modified'">
                    {{ truncate(diff.oldValue, 30) }} → {{ truncate(diff.newValue, 30) }}
                  </template>
                  <template v-else-if="diff.diffType === 'added'">
                    + {{ truncate(diff.newValue, 50) }}
                  </template>
                  <template v-else-if="diff.diffType === 'removed'">
                    - {{ truncate(diff.oldValue, 50) }}
                  </template>
                </span>
              </div>
              <div v-if="restorePreviewDiff.diffs.every((d: any) => d.diffType === 'unchanged')" style="color:#a19f9d; font-size:13px; padding:16px 0; text-align:center">
                当前版本与目标版本完全相同，无需恢复。
              </div>
            </div>
            <n-empty v-else-if="!restorePreviewLoading" description="无法加载预览" style="padding:24px 0" />
          </n-spin>
        </div>

        <!-- Step 2: Confirm with reason -->
        <div v-else>
          <n-alert type="warning" :bordered="false" style="margin-bottom: 12px">
            恢复操作将以当前内容创建一个自动快照，然后将条目内容回退到目标版本。此操作不可撤销，但所有历史版本均会保留。
          </n-alert>
          <div style="margin-bottom: 8px; font-size: 13px; font-weight: 500">恢复原因（必填）</div>
          <n-input
            v-model:value="restoreReason"
            type="textarea"
            placeholder="请简要说明恢复原因，如：误操作需回退 / 审核不通过需还原..."
            :rows="3"
            maxlength="500"
            show-count
          />
        </div>

        <template #footer>
          <n-space justify="end">
            <n-button @click="showRestoreDialog = false">取消</n-button>
            <template v-if="restoreStep === 'preview'">
              <n-button
                type="warning"
                :disabled="restorePreviewLoading || restorePreviewDiff?.diffs?.every((d: any) => d.diffType === 'unchanged')"
                @click="restoreStep = 'confirm'"
              >
                下一步：填写原因
              </n-button>
            </template>
            <template v-else>
              <n-button quaternary @click="restoreStep = 'preview'">上一步</n-button>
              <n-button
                type="warning"
                :loading="restoreLoading"
                :disabled="!restoreReason.trim()"
                @click="confirmRestore"
              >
                确认恢复
              </n-button>
            </template>
          </n-space>
        </template>
      </n-modal>
    </div>
  </n-spin>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import {
  NBreadcrumb, NBreadcrumbItem, NSpin, NCard, NForm, NFormItem, NInput,
  NSelect, NButton, NTag, NTimeline, NTimelineItem, NModal,
  NPopconfirm, NEmpty, NSpace, NScrollbar,
  useMessage, useDialog, NGrid, NGi,
  NAlert, NTooltip, NText, NEllipsis, NRadioGroup, NRadioButton,
  NDescriptions, NDescriptionsItem,
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import request from '@/utils/request/req'
import {
  createKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  getKnowledgeItemDetail,
  type KnowledgeItemReq,
} from '@/api/knowledgeItem'
import CweSelector from '@/components/knowledge/CweSelector.vue'
import RiskScoreCard from '@/components/knowledge/RiskScoreCard.vue'
import CodeEditor from '@/components/knowledge/CodeEditor.vue'
import TagPicker from '@/components/knowledge/TagPicker.vue'
import FragmentSelector from '@/components/knowledge/FragmentSelector.vue'
import { getCweReferenceListAll, type CweReference } from '@/api/cwe'
import { getKnowledgeTagList, createKnowledgeTag } from '@/api/knowledgeTag'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const kid = computed(() => String(route.params.kid || ''))
const uuid = computed(() => String(route.params.uuid || ''))

/** 保存/发布/归档成功后跳转时跳过 dirty 检查，避免误弹「未保存的更改」 */
const skipDirtyCheck = ref(false)

// ─── 元数据（创建/更新/作者） ───
const itemMeta = reactive<{ createdAt?: string; updatedAt?: string; author?: string }>({})

function formatMetaTime(val: string) {
  if (!val) return ''
  try {
    const d = new Date(val)
    return isNaN(d.getTime()) ? val : d.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return val
  }
}

// ─── Page State ───
const pageLoading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const saveSuccessFlash = ref(false)
const kbName = ref('')
const showCweSelector = ref(false)

// ─── CWE Data for Display ───
const cweList = ref<CweReference[]>([])
const cweLoading = ref(false)

// ─── Tag Data（标签列表，供 TagPicker 展示与创建） ───
const systemTags = ref<{ name: string; type: 'system' | 'user'; description?: string; category?: string }[]>([])
const userTags = ref<{ name: string; type: 'system' | 'user'; description?: string; category?: string }[]>([])

async function loadTagData() {
  try {
    const res: any = await getKnowledgeTagList({ pageNum: 1, pageSize: 1000 })
    const rows = res?.rows ?? res?.data?.rows ?? res?.data ?? []
    const allTags = rows.map((tag: any) => ({
      name: tag.tagName || '',
      type: (tag.tagType || 'user') as 'system' | 'user',
      description: tag.description || '',
      category: tag.tagCategory || '',
    }))
    systemTags.value = allTags.filter((t: any) => t.type === 'system')
    userTags.value = allTags.filter((t: any) => t.type === 'user')
  } catch (e) {
    console.error('加载标签失败:', e)
  }
}

async function handleTagCreate(tagName: string, description?: string) {
  const trimmed = tagName.trim()
  if (!trimmed) return
  if (systemTags.value.some(t => t.name === trimmed) || userTags.value.some(t => t.name === trimmed)) return
  try {
    const res: any = await createKnowledgeTag({
      tagName: trimmed,
      tagType: 'user',
      description: description?.trim() || undefined,
    })
    if (res?.code === 200) {
      userTags.value.push({
        name: trimmed,
        type: 'user',
        description: description?.trim() || undefined,
      })
      message.success(`标签"${trimmed}"创建成功`)
    } else {
      message.error(res?.msg || '创建标签失败')
    }
  } catch (e: any) {
    message.error(e?.message || '创建标签失败')
  }
}

// 加载 CWE 数据用于显示名称
async function loadCweList() {
  if (cweList.value.length > 0) return
  cweLoading.value = true
  try {
    const res: any = await getCweReferenceListAll()
    if (res.code === 200) {
      cweList.value = res.data || []
    }
  } catch (e) {
    console.error('加载 CWE 数据失败:', e)
  } finally {
    cweLoading.value = false
  }
}

// 获取 CWE 显示名称（格式：CWE-282: 所有权管理不当）
function getCweDisplayName(cweId: string | null): string {
  if (!cweId) return ''
  const cwe = cweList.value.find(c => c.cweId === cweId)
  if (!cwe) return cweId
  return `${cweId}${cwe.nameZh ? ': ' + cwe.nameZh : cwe.nameEn ? ': ' + cwe.nameEn : ''}`
}

// CWE 选择器确认处理（多选模式，参考旧前端）
function handleCweConfirm(selectedCweIds: string[]) {
  form.cweIds = [...selectedCweIds]
  showCweSelector.value = false
}

// 从已选 CWE 中移除
function removeCwe(cweId: string) {
  form.cweIds = form.cweIds.filter(id => id !== cweId)
}

// ─── Form Data ───
interface Tag {
  name: string
  type: 'system' | 'user'
  description?: string
  category?: string
}

interface ItemForm {
  title: string
  summary: string
  status: string
  cweIds: string[]
  severity: string | null
  cvssScore: number | null
  cvssVector: string
  riskAttackVector: string | null
  riskComplexity: string | null
  riskPrivileges: string | null
  riskUserInteraction: string | null
  riskImpact: string[]
  description: string
  solution: string
  exampleCode: string
  references: string
  language: string
  tags: Tag[]
}

const defaultForm = (): ItemForm => ({
  title: '',
  summary: '',
  status: 'draft',
  cweIds: [],
  severity: null,
  cvssScore: null,
  cvssVector: '',
  riskAttackVector: null,
  riskComplexity: null,
  riskPrivileges: null,
  riskUserInteraction: null,
  riskImpact: [],
  description: '',
  solution: '',
  exampleCode: '',
  references: '',
  language: '',
  tags: [],
})

const form = reactive<ItemForm>(defaultForm())
let initialSnapshot = ''

const isDirty = computed(() => JSON.stringify(form) !== initialSnapshot)

/** 表单是否满足最低保存条件（标题 + CVSS 分量必填） */
const cvssComplete = computed(() =>
  !!form.riskAttackVector && !!form.riskComplexity && !!form.riskPrivileges &&
  !!form.riskUserInteraction && Array.isArray(form.riskImpact) && form.riskImpact.length > 0
)
const canSave = computed(() => (form.title ?? '').trim().length > 0 && cvssComplete.value)

function takeSnapshot() {
  initialSnapshot = JSON.stringify(form)
}

function loadFormData(data: any) {
  itemMeta.createdAt = data.createdAt ?? data.createTime ?? ''
  itemMeta.updatedAt = data.updatedAt ?? data.updateTime ?? ''
  itemMeta.author = data.author ?? data.createByName ?? data.updateByName ?? ''
  form.title = data.title ?? ''
  form.summary = data.summary ?? ''
  form.status = data.status ?? 'draft'
  form.cweIds = Array.isArray(data.vulnerabilityTypes)
    ? [...data.vulnerabilityTypes]
    : (data.cweId ? [data.cweId] : [])
  form.severity = data.severity ?? null
  form.cvssScore = data.cvssScore ?? null
  form.cvssVector = data.cvssVector ?? ''
  const parsed = parseCvssVector(data.cvssVector)
  const impact = extractCvssImpactFromVector(data.cvssVector)
  form.riskAttackVector = data.riskAttackVector ?? data.cvssAttackVector ?? parsed?.av ?? null
  form.riskComplexity = data.riskComplexity ?? data.cvssAttackComplexity ?? parsed?.ac ?? null
  form.riskPrivileges = data.riskPrivileges ?? data.cvssPrivilegesRequired ?? parsed?.pr ?? null
  form.riskUserInteraction = data.riskUserInteraction ?? data.cvssUserInteraction ?? parsed?.ui ?? null
  form.riskImpact = Array.isArray(data.riskImpact) ? [...data.riskImpact] : (Array.isArray(data.cvssImpact) ? [...data.cvssImpact] : impact)
  form.description = data.description ?? data.problemDescription ?? ''
  form.solution = data.solution ?? data.fixSolution ?? ''
  form.exampleCode = data.exampleCode ?? ''
  form.references = data.references ?? data.referenceLink ?? ''
  form.language = data.language ?? ''
  // tags 可能是 string[] 或 Tag[]，统一转为 Tag[]
  const rawTags = data.tags ?? []
  form.tags = rawTags.map((t: any) =>
    typeof t === 'string' ? { name: t, type: 'user' as const } : t
  )
  takeSnapshot()
}

// ─── CVSS 风险维度（参考旧前端，用户选择维度后系统自动生成向量） ───
const riskAttackVectorOptions = [
  { label: '远程', value: 'N', description: '可通过网络远程利用' },
  { label: '本地', value: 'L', description: '需要本地访问' },
  { label: '网络相邻', value: 'A', description: '需要同一网络环境' },
  { label: '物理', value: 'P', description: '需要物理接触' },
]
const riskComplexityOptions = [
  { label: '低', value: 'L', description: '利用条件简单，容易触发' },
  { label: '高', value: 'H', description: '利用条件复杂，难以触发' },
]
const riskPrivilegesOptions = [
  { label: '无需权限', value: 'N', description: '普通用户即可利用' },
  { label: '需要权限', value: 'L', description: '需要登录或基本权限' },
  { label: '高级权限', value: 'H', description: '需要管理员或系统权限' },
]
const riskUserInteractionOptions = [
  { label: '无需交互', value: 'N', description: '无需用户操作即可利用' },
  { label: '需要交互', value: 'R', description: '需要用户执行某些操作' },
]
const riskImpactOptions = [
  { label: '机密性', value: 'C', description: '可能泄露敏感信息' },
  { label: '完整性', value: 'I', description: '可能篡改数据或系统' },
  { label: '可用性', value: 'A', description: '可能导致服务中断' },
]

function parseCvssVector(cvssVector?: string): { av?: string; ac?: string; pr?: string; ui?: string; vc?: string; vi?: string; va?: string } | null {
  if (!cvssVector) return null
  const result: Record<string, string> = {}
  cvssVector.split('/').forEach(part => {
    const [key, value] = part.split(':')
    if (key && value) result[key.toLowerCase()] = value
  })
  return result
}

function extractCvssImpactFromVector(cvssVector?: string): string[] {
  const parsed = parseCvssVector(cvssVector)
  if (!parsed) return []
  const impacts: string[] = []
  if (parsed.vc === 'H') impacts.push('C')
  if (parsed.vi === 'H') impacts.push('I')
  if (parsed.va === 'H') impacts.push('A')
  return impacts
}

function generateCvssVector(): string | undefined {
  const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = form
  if (!riskAttackVector || !riskComplexity || !riskPrivileges || !riskUserInteraction || !riskImpact?.length) return undefined
  const impactStr = [...riskImpact].sort().join('')
  return `CVSS:4.0/AV:${riskAttackVector}/AC:${riskComplexity}/AT:N/PR:${riskPrivileges}/UI:${riskUserInteraction}/VC:${impactStr.includes('C') ? 'H' : 'N'}/VI:${impactStr.includes('I') ? 'H' : 'N'}/VA:${impactStr.includes('A') ? 'H' : 'N'}/SC:N/SI:N/SA:N`
}

const calculatedRiskScore = computed(() => {
  const { riskAttackVector, riskComplexity, riskPrivileges, riskUserInteraction, riskImpact } = form
  const allEmpty = !riskAttackVector && !riskComplexity && !riskPrivileges && !riskUserInteraction && (!riskImpact?.length)
  if (allEmpty) return null
  const avScores: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }
  const acScores: Record<string, number> = { L: 0.77, H: 0.44 }
  const prScores: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 }
  const uiScores: Record<string, number> = { N: 0.85, R: 0.62 }
  const impactScores: Record<string, number> = { C: 0.22, I: 0.22, A: 0.22 }
  let baseScore = 0
  if (riskAttackVector) baseScore += avScores[riskAttackVector] ?? 0
  if (riskComplexity) baseScore += acScores[riskComplexity] ?? 0
  if (riskPrivileges) baseScore += prScores[riskPrivileges] ?? 0
  if (riskUserInteraction) baseScore += uiScores[riskUserInteraction] ?? 0
  let maxImpact = 0
  if (riskImpact?.length) riskImpact.forEach((imp: string) => { maxImpact = Math.max(maxImpact, impactScores[imp] ?? 0) })
  baseScore += maxImpact * 3
  const score = Math.min(10, Math.max(0, baseScore * 1.08))
  const isComplete = !!(riskAttackVector && riskComplexity && riskPrivileges && riskUserInteraction && riskImpact?.length)
  if (isComplete) return { exact: Math.round(score * 10) / 10, min: null, max: null, isComplete: true }
  let maxPossible = score
  if (!riskAttackVector) maxPossible += avScores.N * 1.08
  if (!riskComplexity) maxPossible += acScores.L * 1.08
  if (!riskPrivileges) maxPossible += prScores.N * 1.08
  if (!riskUserInteraction) maxPossible += uiScores.N * 1.08
  if (!riskImpact?.length) maxPossible += impactScores.C * 3 * 1.08
  maxPossible = Math.min(10, maxPossible)
  return { exact: null, min: Math.round(score * 10) / 10, max: Math.round(maxPossible * 10) / 10, isComplete: false }
})

const calculatedRiskLevel = computed(() => {
  const score = calculatedRiskScore.value
  if (!score) return null
  const v = score.exact ?? score.max ?? 0
  if (v >= 9.0) return { value: 'critical', label: '极高', color: '#d13438' }
  if (v >= 7.0) return { value: 'high', label: '高', color: '#ff8c00' }
  if (v >= 4.0) return { value: 'medium', label: '中', color: '#ffaa44' }
  if (v >= 0.1) return { value: 'low', label: '低', color: '#107c10' }
  return { value: 'none', label: '无', color: '#8a8886' }
})

// 维度变化时自动更新 cvssVector、cvssScore、severity（任一维度变更即更新，含取消选择）
watch(calculatedRiskScore, (score) => {
  if (score?.isComplete && score.exact != null) {
    form.cvssScore = score.exact
    const vec = generateCvssVector()
    if (vec) form.cvssVector = vec
    const level = calculatedRiskLevel.value
    if (level) form.severity = level.value === 'critical' ? 'Critical' : level.value === 'high' ? 'High' : level.value === 'medium' ? 'Medium' : level.value === 'low' ? 'Low' : 'None'
  } else {
    form.cvssScore = null
    form.cvssVector = ''
    if (score && !score.isComplete) form.severity = null
  }
}, { deep: true })

// ─── Language Options ───
const languageOptions: SelectOption[] = [
  { label: 'Java', value: 'java' },
  { label: 'Python', value: 'python' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'C/C++', value: 'c_cpp' },
  { label: 'C#', value: 'csharp' },
  { label: 'Go', value: 'go' },
  { label: 'Rust', value: 'rust' },
  { label: 'PHP', value: 'php' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'Swift', value: 'swift' },
  { label: 'Kotlin', value: 'kotlin' },
  { label: 'SQL', value: 'sql' },
  { label: 'Shell', value: 'shell' },
  { label: 'XML/HTML', value: 'xml' },
  { label: 'YAML', value: 'yaml' },
  { label: '其他', value: 'other' },
]

// ─── Fragments ───
const fragments = ref<any[]>([])
const fragmentsLoading = ref(false)
const expandedFragments = ref<Set<string>>(new Set())

function toggleFragment(id: string) {
  const sel = window.getSelection?.()
  if (sel?.type === 'Range' && sel.toString().length > 0) return
  if (expandedFragments.value.has(id)) {
    expandedFragments.value.delete(id)
  } else {
    expandedFragments.value.add(id)
  }
}

// ─── Fragment Selector ───
const showFragmentDialog = ref(false)

// 处理FragmentSelector的选择事件
async function handleFragmentSelect(selectedFragments: any[]) {
  // 选择后自动关联未关联的片段
  const unassociatedIds = selectedFragments
    .filter((f: any) => !f.isAssociated)
    .map((f: any) => f.id)
  
  if (unassociatedIds.length > 0) {
    await handleFragmentBatchAssociate(unassociatedIds)
  }
}

// 处理FragmentSelector的批量关联事件（FragmentSelector 内部已执行 API，此处仅刷新）
async function handleFragmentBatchAssociate(_fragmentIds: string[]) {
  await loadFragments()
}

// 处理FragmentSelector的批量解除关联事件（FragmentSelector 内部已执行 API，此处仅刷新）
async function handleFragmentBatchDisassociate(_fragmentIds: string[]) {
  await loadFragments()
}

async function removeFragment(fragmentId: string) {
  try {
    await request.delete(`/knowledge/item/${uuid.value}/fragments/${fragmentId}`)
    message.success('已移除关联')
    await loadFragments()
  } catch (e: any) {
    message.error(e?.message || '移除关联失败')
  }
}

// ─── Version History ───
const versionHistory = ref<any[]>([])
const versionLoading = ref(false)
const showVersionModal = ref(false)
const versionSnapshot = ref<any | null>(null)
const showVersionJson = ref(false)

const versionSnapshotData = computed(() => versionSnapshot.value || null)
const versionSnapshotJson = computed(() =>
  versionSnapshot.value ? JSON.stringify(versionSnapshot.value, null, 2) : ''
)

// Diff state
const showDiffModal = ref(false)
const diffLoading = ref(false)
const diffResult = ref<any>(null)
const diffViewMode = ref<'side-by-side' | 'inline'>(
  (localStorage.getItem('diff-view-mode') as any) || 'side-by-side'
)
const currentDiffIndex = ref(-1)
const diffFieldRefs = ref<HTMLElement[]>([])

// Computed: changed fields only (for navigation)
const changedDiffIndices = computed(() => {
  if (!diffResult.value?.diffs) return []
  return diffResult.value.diffs
    .map((d: any, i: number) => d.diffType !== 'unchanged' ? i : -1)
    .filter((i: number) => i >= 0)
})

function setDiffFieldRef(el: any, idx: string | number) {
  if (el) diffFieldRefs.value[Number(idx)] = el
}

function navigateDiff(direction: 'prev' | 'next') {
  const indices = changedDiffIndices.value
  if (indices.length === 0) return
  const curPos = indices.indexOf(currentDiffIndex.value)
  let nextPos: number
  if (direction === 'next') {
    nextPos = curPos < indices.length - 1 ? curPos + 1 : 0
  } else {
    nextPos = curPos > 0 ? curPos - 1 : indices.length - 1
  }
  currentDiffIndex.value = indices[nextPos]
  const el = diffFieldRefs.value[currentDiffIndex.value]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

watch(diffViewMode, (mode) => {
  localStorage.setItem('diff-view-mode', mode)
})

// Restore state
const showRestoreDialog = ref(false)
const restoreLoading = ref(false)
const restoreReason = ref('')
const restoreTargetVersion = ref<number>(0)
const restoreTargetEntry = ref<any>(null)
const restorePreviewDiff = ref<any>(null)
const restorePreviewLoading = ref(false)
const restoreStep = ref<'preview' | 'confirm'>('preview')

function changeTypeBadge(changeType: string): { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' } {
  switch (changeType) {
    case 'create': return { label: '创建', type: 'success' }
    case 'update': return { label: '编辑', type: 'info' }
    case 'restore': return { label: '恢复', type: 'warning' }
    case 'pre_restore': return { label: '恢复前快照', type: 'default' }
    case 'publish': return { label: '发布', type: 'success' }
    case 'archive': return { label: '归档', type: 'default' }
    default: return { label: changeType || '变更', type: 'default' }
  }
}

function diffTypeTag(diffType: string): { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' } {
  switch (diffType) {
    case 'added': return { label: '新增', type: 'success' }
    case 'removed': return { label: '删除', type: 'error' }
    case 'modified': return { label: '修改', type: 'warning' }
    case 'unchanged': return { label: '未变', type: 'default' }
    default: return { label: diffType, type: 'default' }
  }
}

function formatVersionTime(time: any): string {
  if (!time) return ''
  try {
    const d = new Date(time)
    if (isNaN(d.getTime())) return String(time)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin} 分钟前`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} 小时前`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 7) return `${diffDay} 天前`
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
      + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(time)
  }
}

function viewVersion(entry: any) {
  versionSnapshot.value = entry.snapshot ?? entry
  showVersionJson.value = false
  showVersionModal.value = true
}

function openDiffModal(fromEntry: any, toEntry: any) {
  showDiffModal.value = true
  diffLoading.value = true
  diffResult.value = null
  currentDiffIndex.value = -1
  diffFieldRefs.value = []
  try {
    const fromVer = Number(fromEntry.version)
    const toVer = Number(toEntry.version)
    request({
      url: `/knowledge/item/${uuid.value}/history/diff`,
      method: 'get',
      params: { from: fromVer, to: toVer },
    }).then((res: any) => {
      diffResult.value = res.data ?? res
    }).catch((e: any) => {
      message.error('加载对比数据失败：' + (e?.message || ''))
    }).finally(() => {
      diffLoading.value = false
    })
  } catch (e: any) {
    message.error('加载对比数据失败：' + (e?.message || ''))
    diffLoading.value = false
  }
}

function truncate(str: string | null | undefined, maxLen: number): string {
  if (!str) return '（空）'
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
}

function openRestoreDialog(entry: any) {
  restoreTargetVersion.value = entry.version ?? entry.id
  restoreTargetEntry.value = entry
  restoreReason.value = ''
  restoreStep.value = 'preview'
  restorePreviewDiff.value = null
  showRestoreDialog.value = true
  // Auto-load preview diff
  loadRestorePreview(entry)
}

async function loadRestorePreview(entry: any) {
  restorePreviewLoading.value = true
  try {
    const currentVer = versionHistory.value[0]?.version
    const targetVer = entry.version ?? entry.id
    if (currentVer && targetVer) {
      const res: any = await request({
        url: `/knowledge/item/${uuid.value}/history/diff`,
        method: 'get',
        params: { from: currentVer, to: targetVer },
      })
      restorePreviewDiff.value = res.data ?? res
    }
  } catch { /* silent */ } finally {
    restorePreviewLoading.value = false
  }
}

async function confirmRestore() {
  if (!restoreReason.value.trim()) {
    message.warning('请填写恢复原因')
    return
  }
  restoreLoading.value = true
  try {
    await request({
      url: `/knowledge/item/${uuid.value}/history/${restoreTargetVersion.value}/restore`,
      method: 'post',
      data: { reason: restoreReason.value.trim() },
    })
    message.success('恢复成功')
    showRestoreDialog.value = false
    await loadItem()
    await loadVersionHistory()
  } catch (e: any) {
    message.error(e?.message || '恢复失败')
  } finally {
    restoreLoading.value = false
  }
}

// ─── API Calls ───
async function loadItem() {
  // 新建模式：不调 API，初始化空表单
  if (uuid.value === 'new') {
    const prefillRaw = sessionStorage.getItem('ai_extract_prefill')
    if (prefillRaw) {
      try {
        const prefill = JSON.parse(prefillRaw)
        form.title = prefill.title || ''
        form.summary = prefill.summary || ''
        form.cweIds = Array.isArray(prefill.vulnerabilityTypes)
          ? [...prefill.vulnerabilityTypes]
          : (prefill.vulnerabilityType || prefill.cweId ? [prefill.vulnerabilityType || prefill.cweId] : [])
        const prefillParsed = parseCvssVector(prefill.cvssVector)
        const prefillImpact = extractCvssImpactFromVector(prefill.cvssVector)
        form.riskAttackVector = prefill.riskAttackVector ?? prefill.cvssAttackVector ?? prefillParsed?.av ?? null
        form.riskComplexity = prefill.riskComplexity ?? prefill.cvssAttackComplexity ?? prefillParsed?.ac ?? null
        form.riskPrivileges = prefill.riskPrivileges ?? prefill.cvssPrivilegesRequired ?? prefillParsed?.pr ?? null
        form.riskUserInteraction = prefill.riskUserInteraction ?? prefill.cvssUserInteraction ?? prefillParsed?.ui ?? null
        form.riskImpact = Array.isArray(prefill.riskImpact) ? [...prefill.riskImpact] : (Array.isArray(prefill.cvssImpact) ? [...prefill.cvssImpact] : prefillImpact)
        form.severity = prefill.severity || null
        form.cvssScore = prefill.cvssScore ?? null
        form.cvssVector = prefill.cvssVector || ''
        form.description = prefill.problemDescription || prefill.description || ''
        form.solution = prefill.fixSuggestion || prefill.solution || ''
        form.exampleCode = prefill.exampleCode || ''
        form.references = prefill.referenceLinks || prefill.references || ''
        form.language = prefill.language || ''
        // tags: AI 可能返回 string[] 或 Tag[]
        if (Array.isArray(prefill.suggestedTags || prefill.tags)) {
          const raw = prefill.suggestedTags || prefill.tags
          form.tags = raw.map((t: any) =>
            typeof t === 'string' ? { name: t, type: 'user' as const } : t
          )
        }
      } catch { /* 解析失败用空表单 */ }
      sessionStorage.removeItem('ai_extract_prefill')
    }
    initialSnapshot = JSON.stringify(form)
    return
  }
  try {
    const res: any = await getKnowledgeItemDetail(uuid.value)
    loadFormData(res?.data ?? res)
  } catch (e: any) {
    message.error(e?.message || '加载条目失败')
  }
}

async function loadKbInfo() {
  try {
    const res = await request.get(`/knowledge/base/${kid.value}`)
    kbName.value = res.data?.kname ?? res.data?.name ?? res.data?.title ?? '未知知识库'
  } catch (e: any) {
    kbName.value = '未知知识库'
  }
}

async function loadFragments() {
  fragmentsLoading.value = true
  try {
    const res = await request.get(`/knowledge/item/${uuid.value}/fragments`)
    fragments.value = res.data?.list ?? res.data ?? []
  } catch (e: any) {
    message.error(e?.message || '加载片段失败')
  } finally {
    fragmentsLoading.value = false
  }
}

async function loadVersionHistory() {
  if (uuid.value === 'new') {
    versionHistory.value = []
    return
  }
  versionLoading.value = true
  try {
    const res = await request.get(`/knowledge/item/${uuid.value}/history`)
    versionHistory.value = res.data?.list ?? res.data ?? []
  } catch (e: any) {
    message.error(e?.message || '加载版本历史失败')
  } finally {
    versionLoading.value = false
  }
}

// ─── Save / Publish / Archive / Delete ───
async function saveItem(status: string) {
  if (!form.title.trim()) {
    message.warning('标题不能为空')
    return
  }
  if (!cvssComplete.value) {
    message.warning('请完整填写 CVSS 分量（攻击方式、利用复杂度、权限需求、用户交互、影响范围）')
    return
  }
  saving.value = true
  try {
    const vec = generateCvssVector()
    if (vec) form.cvssVector = vec
    const payload: Record<string, any> = {
      kid: kid.value,
      title: form.title,
      summary: form.summary,
      status,
      vulnerabilityTypes: form.cweIds,
      severity: form.severity,
      cvssScore: form.cvssScore,
      cvssVector: form.cvssVector,
      problemDescription: form.description,
      fixSolution: form.solution,
      exampleCode: form.exampleCode,
      referenceLink: form.references,
      language: form.language,
      tags: form.tags.map(t => t.name),
    }
    const isNew = uuid.value === 'new'
    if (!isNew) {
      payload.itemUuid = uuid.value
    }
    if (isNew) {
      await createKnowledgeItem(payload as KnowledgeItemReq)
    } else {
      await updateKnowledgeItem(uuid.value, payload as KnowledgeItemReq)
    }
    form.status = status
    takeSnapshot()
    itemMeta.updatedAt = new Date().toISOString()
    message.success(status === 'published' ? '发布成功' : status === 'archived' ? '归档成功' : '保存成功')
    saveSuccessFlash.value = true
    setTimeout(() => { saveSuccessFlash.value = false }, 600)
    // 保存/发布/归档成功后返回条目列表页，跳过离开前的 dirty 检查
    skipDirtyCheck.value = true
    router.replace(`/knowledge-v2/${kid.value}?tab=items`)
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function handleArchive() {
  dialog.warning({
    title: '确认归档',
    content: '归档后条目将不再显示在主列表中，确定归档？',
    positiveText: '归档',
    negativeText: '取消',
    onPositiveClick: () => saveItem('archived'),
  })
}

async function handleDelete() {
  deleting.value = true
  try {
    await deleteKnowledgeItem(uuid.value)
    message.success('删除成功')
    skipDirtyCheck.value = true
    router.push(`/knowledge-v2/${kid.value}?tab=items`)
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

// ─── Route Leave Guard ───
onBeforeRouteLeave((_to, _from, next) => {
  if (skipDirtyCheck.value) {
    skipDirtyCheck.value = false
    next()
    return
  }
  if (isDirty.value) {
    dialog.warning({
      title: '未保存的更改',
      content: '当前页面有未保存的更改，确定离开？',
      positiveText: '离开',
      negativeText: '留下',
      onPositiveClick: () => next(),
      onNegativeClick: () => next(false),
    })
  } else {
    next()
  }
})

// 键盘快捷键处理
function keydownHandler(e: KeyboardEvent) {
  // Ctrl/Cmd + S: 保存（草稿或当前状态）
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (canSave.value && !saving.value) {
      saveItem(isDirty.value ? 'draft' : form.status)
    }
    return
  }
  
  // Ctrl/Cmd + Enter: 快速发布
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    if (canSave.value && !saving.value && form.status !== 'published') {
      saveItem('published')
    }
    return
  }
  
  // Ctrl/Cmd + D: 保存草稿
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault()
    if (canSave.value && !saving.value) {
      saveItem('draft')
    }
    return
  }
  
  // Ctrl/Cmd + Shift + A: 打开添加片段对话框
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
    e.preventDefault()
    showFragmentDialog.value = true
    return
  }
  
  // Esc: 关闭弹窗（如果有打开的）
  if (e.key === 'Escape') {
    if (showFragmentDialog.value) {
      showFragmentDialog.value = false
    } else if (showCweSelector.value) {
      showCweSelector.value = false
    }
    return
  }
}

// Browser beforeunload
function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// ─── Init ───
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
  window.addEventListener('keydown', keydownHandler)
  pageLoading.value = true
  // 并行加载页面数据和 CWE 数据
  await Promise.all([
    loadItem(),
    loadKbInfo(),
    loadFragments(),
    loadVersionHistory(),
    loadCweList(),
    loadTagData()
  ])
  pageLoading.value = false
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
  window.removeEventListener('keydown', keydownHandler)
})
</script>

<style scoped>
.item-detail-page {
  background: #FAF9F8;
  min-height: 100vh;
  padding: 16px 32px 80px;
  color: #323130;
  max-width: 1800px;
  margin: 0 auto;
}

.breadcrumb {
  margin-bottom: 16px;
}
.breadcrumb-clickable {
  cursor: pointer;
}
.breadcrumb-clickable:hover {
  color: #0078d4;
}
.item-meta-bar {
  margin-bottom: 12px;
  padding: 4px 0;
}

.main-columns {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.left-col {
  flex: 0 0 60%;
  min-width: 0;
}

.right-col {
  flex: 0 0 calc(40% - 16px);
  min-width: 0;
}

.form-card {
  margin-bottom: 16px;
}

.risk-dimensions-hint {
  font-size: 12px;
  color: #605e5c;
  margin-top: 4px;
  margin-bottom: 4px;
}

.select-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.select-option .option-label { font-weight: 500; }
.select-option .option-desc { font-size: 12px; color: #605e5c; }

.version-section {
  margin-top: 8px;
}

.action-bar {
  position: fixed;
  bottom: 0;
  /* 使用 --ai-sider-width 自动适配侧栏，+buffer 避免左侧阴影/边框凸出 */
  left: calc(var(--ai-sider-width, 70px) + var(--action-bar-left-buffer, 4px));
  right: calc(var(--ai-sider-width, 70px) + var(--global-upload-fab-margin, 24px) + var(--global-upload-fab-size, 56px) + var(--action-bar-side-gap, 16px));
  background: #fff;
  border-top: 1px solid #EDEBE9;
  padding: 10px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
}
.action-bar--saved {
  border-top-color: #107c10;
  box-shadow: 0 -2px 12px rgba(16, 124, 16, 0.25);
}

.fragment-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fragment-card {
  border: 1px solid #EDEBE9;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #fff;
  transition: box-shadow 0.2s;
}

.fragment-card:hover {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.fragment-content {
  cursor: pointer;
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: #323130;
}

.fragment-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #F3F2F1;
}

.search-result-item:last-child {
  border-bottom: none;
}

.version-snapshot {
  background: #F3F2F1;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.version-snapshot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.version-snapshot-title {
  font-weight: 600;
  font-size: 14px;
  color: #323130;
}

.version-snapshot-meta {
  font-size: 12px;
  color: #605e5c;
}

.version-snapshot-section {
  margin-bottom: 4px;
}

.version-snapshot-reason {
  font-size: 12px;
}

.version-snapshot-field {
  margin-bottom: 8px;
}

.version-snapshot-field__label {
  font-size: 12px;
  color: #605e5c;
  margin-bottom: 4px;
  font-weight: 500;
}

.version-snapshot-empty {
  font-size: 12px;
  color: #a19f9d;
}

.version-snapshot-json {
  background: #F3F2F1;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

/* ===== Diff Viewer ===== */
.diff-viewer {
  padding: 0;
}

.diff-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #faf9f8;
  border-radius: 6px;
  margin-bottom: 12px;
}

.diff-meta__side {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #323130;
}

.diff-field {
  border: 1px solid #edebe9;
  border-radius: 6px;
  margin-bottom: 10px;
  overflow: hidden;
}

.diff-field__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #faf9f8;
  border-bottom: 1px solid #edebe9;
}

.diff-field__label {
  font-size: 13px;
  font-weight: 600;
  color: #323130;
}

.diff-field__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.diff-field__old,
.diff-field__new {
  padding: 8px 12px;
}

.diff-field__old {
  background: #fde7e9;
  border-right: 1px solid #edebe9;
}

.diff-field__new {
  background: #dff6dd;
}

.diff-field__side-label {
  font-size: 11px;
  font-weight: 600;
  color: #605e5c;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.diff-field__content {
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  max-height: 200px;
  overflow-y: auto;
}

.diff-field__content--old {
  color: #a4262c;
}

.diff-field__content--new {
  color: #107c10;
}

.diff-field__unchanged {
  padding: 6px 12px;
}

@media (max-width: 768px) {
  .diff-field__body {
    grid-template-columns: 1fr;
  }
  .diff-field__old {
    border-right: none;
    border-bottom: 1px solid #edebe9;
  }
}

.empty-state {
  padding: 24px 0;
}

/* Responsive: stack columns on mobile */
@media (max-width: 768px) {
  .main-columns {
    flex-direction: column;
  }
  .left-col,
  .right-col {
    flex: 1 1 100%;
  }
}
</style>
