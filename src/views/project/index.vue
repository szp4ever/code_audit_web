<script setup lang='ts'>
import { ref, computed, onMounted, h } from 'vue'
import {
  NButton,
  NInput,
  NSelect,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NTag,
  NEmpty,
  NMessageProvider,
  useMessage,
  NSpace,
  NCard,
  NGrid,
  NGridItem,
  NIcon,
  NPopconfirm,
  NText,
  NStatistic,
  NDivider
} from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { 
  createProject, 
  fetchProjectList, 
  updateProject, 
  deleteProject, 
  getProjectStatistics,
  Project, 
  ProjectStatus 
} from '@/api/project'
import { getUserInfo } from '@/api/user'
import { fetchTaskList, TaskStatus } from '@/api/task'
import { AddOutline, TrashOutline, CreateOutline, FolderOutline, ListOutline, ArchiveOutline } from '@vicons/ionicons5'
import { useRouter } from 'vue-router'

const router = useRouter()
const ms = useMessage()

// 项目列表
const projects = ref<Project[]>([])
const loading = ref(false)
const total = ref(0)
const pagination = ref({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onChange: (page: number) => {
    pagination.value.page = page
    loadProjects()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.value.pageSize = pageSize
    pagination.value.page = 1
    loadProjects()
  }
})

// 筛选条件
const filterStatus = ref<ProjectStatus | null>(null)
const searchKeyword = ref('')

// 创建/编辑项目模态框
const showModal = ref(false)
const isEdit = ref(false)
const currentProject = ref<Project>({
  name: '',
  description: '',
  status: ProjectStatus.ACTIVE,
  tags: [],
  createdBy: '',
  createdById: undefined,
  createdByDept: '',
  createdByDeptId: undefined
})

// 当前用户信息
const currentUser = ref<{ 
  userName?: string
  nickName?: string
  userId?: number | string
  deptName?: string
  deptId?: number | string
}>({})

// 计算项目状态（根据任务完成情况）
const calculateProjectStatus = async (project: Project): Promise<ProjectStatus> => {
  // 如果项目已归档或已取消，保持原状态
  if (project.status === ProjectStatus.ARCHIVED || project.status === ProjectStatus.CANCELLED) {
    return project.status
  }
  
  if (!project.id) {
    return ProjectStatus.ACTIVE
  }
  
  try {
    // 获取项目的所有任务
    const response = await fetchTaskList({ 
      projectId: project.id,
      currentPage: 1,
      pageSize: 1000
    })
    
    let taskList: any[] = []
    if (response && response.code === 200) {
      if (Array.isArray(response.data)) {
        taskList = response.data
      } else if (response.data?.rows) {
        taskList = response.data.rows
      } else if (response.data?.list) {
        taskList = response.data.list
      } else if (response.rows) {
        taskList = response.rows
      } else if (response.list) {
        taskList = response.list
      }
    }
    
    if (taskList.length === 0) {
      return ProjectStatus.ACTIVE
    }
    
    // 统计已完成的任务
    const completedCount = taskList.filter((task: any) => 
      task.status === TaskStatus.COMPLETED
    ).length
    
    // 如果所有任务都完成了，项目状态为已完成
    if (completedCount === taskList.length) {
      return ProjectStatus.COMPLETED
    }
    
    // 否则为进行中
    return ProjectStatus.ACTIVE
  } catch (error) {
    console.error('计算项目状态失败:', error)
    return project.status || ProjectStatus.ACTIVE
  }
}

// 更新项目状态（自动计算）
const updateProjectStatus = async (project: Project) => {
  const newStatus = await calculateProjectStatus(project)
  if (newStatus !== project.status) {
    try {
      await updateProject(project.id!, { status: newStatus })
    } catch (error) {
      console.error('更新项目状态失败:', error)
    }
  }
}

// 状态标签颜色
const statusTagType = (status: ProjectStatus) => {
  const map: Record<ProjectStatus, string> = {
    [ProjectStatus.ACTIVE]: 'info',
    [ProjectStatus.COMPLETED]: 'success',
    [ProjectStatus.ARCHIVED]: 'default',
    [ProjectStatus.CANCELLED]: 'error'
  }
  return map[status] || 'default'
}

// 状态标签文本
const statusLabel = (status: ProjectStatus) => {
  const map: Record<ProjectStatus, string> = {
    [ProjectStatus.ACTIVE]: '进行中',
    [ProjectStatus.COMPLETED]: '已完成',
    [ProjectStatus.ARCHIVED]: '已归档',
    [ProjectStatus.CANCELLED]: '已取消'
  }
  return map[status] || status
}

// 加载项目列表
const loadProjects = async () => {
  try {
    loading.value = true
    const params: any = {
      currentPage: pagination.value.page,
      pageSize: pagination.value.pageSize
    }
    if (filterStatus.value) {
      params.status = filterStatus.value
    }
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }
    
    const response = await fetchProjectList(params)
    if (response && response.code === 200) {
      let projectList: Project[] = []
      if (Array.isArray(response.data)) {
        projectList = response.data
      } else if (response.data?.rows) {
        projectList = response.data.rows
      } else if (response.data?.list) {
        projectList = response.data.list
      } else if (response.rows) {
        projectList = response.rows
      } else if (response.list) {
        projectList = response.list
      }
      
      // 自动计算并更新每个项目的状态
      for (const project of projectList) {
        if (project.id && project.status !== ProjectStatus.ARCHIVED && project.status !== ProjectStatus.CANCELLED) {
          const calculatedStatus = await calculateProjectStatus(project)
          if (calculatedStatus !== project.status) {
            project.status = calculatedStatus
            // 异步更新后端状态（不阻塞列表显示）
            updateProjectStatus(project).catch(console.error)
          }
        }
      }
      
      projects.value = projectList
      total.value = response.data?.total || response.total || projectList.length
    } else {
      ms.error(response?.msg || '加载项目列表失败')
      projects.value = []
      total.value = 0
    }
  } catch (error: any) {
    console.error('加载项目列表失败:', error)
    ms.error(error.message || '加载项目列表失败，请检查网络连接')
    projects.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 打开创建项目模态框
const openCreateModal = async () => {
  isEdit.value = false
  // 获取当前用户信息
  try {
    const userInfo = await getUserInfo()
    if (userInfo && userInfo.data && userInfo.data.user) {
      currentUser.value = {
        userName: userInfo.data.user.userName,
        nickName: userInfo.data.user.nickName,
        userId: userInfo.data.user.userId,
        deptName: userInfo.data.user.deptName || userInfo.data.user.dept?.deptName,
        deptId: userInfo.data.user.deptId || userInfo.data.user.dept?.deptId
      }
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
  
  currentProject.value = {
    name: '',
    description: '',
    status: ProjectStatus.ACTIVE,
    tags: [],
    createdBy: currentUser.value.nickName || currentUser.value.userName || '',
    createdById: currentUser.value.userId,
    createdByDept: currentUser.value.deptName || '',
    createdByDeptId: currentUser.value.deptId
  }
  showModal.value = true
}

// 打开编辑项目模态框
const openEditModal = (project: Project) => {
  isEdit.value = true
  currentProject.value = {
    name: project.name,
    description: project.description,
    status: project.status || ProjectStatus.ACTIVE,
    tags: project.tags || [],
    id: project.id,
    createdBy: project.createdBy,
    createdById: project.createdById,
    createdByDept: project.createdByDept,
    createdByDeptId: project.createdByDeptId
  }
  showModal.value = true
}

// 保存项目
const saveProject = async () => {
  if (!currentProject.value.name.trim()) {
    ms.warning('请输入项目名称')
    return
  }

  try {
    const projectData: any = {
      name: currentProject.value.name,
      description: currentProject.value.description,
      tags: currentProject.value.tags || []
    }
    
    // 创建项目时添加创建人和部门信息
    if (!isEdit.value) {
      projectData.createdBy = currentProject.value.createdBy || currentUser.value.nickName || currentUser.value.userName || ''
      projectData.createdById = currentProject.value.createdById || currentUser.value.userId
      projectData.createdByDept = currentProject.value.createdByDept || currentUser.value.deptName || ''
      projectData.createdByDeptId = currentProject.value.createdByDeptId || currentUser.value.deptId
      // 新建项目默认状态为进行中
      projectData.status = ProjectStatus.ACTIVE
    }
    // 编辑项目时不修改状态、创建人和部门信息

    let success = false
    
    if (isEdit.value && currentProject.value.id) {
      try {
        const response = await updateProject(currentProject.value.id, projectData)
        if (response && response.code === 200) {
          ms.success('项目更新成功')
          success = true
        } else {
          ms.error(response?.msg || '项目更新失败')
        }
      } catch (error: any) {
        console.error('更新项目失败:', error)
        ms.error(error.message || '项目更新失败，请检查网络连接')
      }
    } else {
      try {
        const response = await createProject(projectData)
        if (response && response.code === 200) {
          ms.success('项目创建成功')
          success = true
        } else {
          ms.error(response?.msg || '项目创建失败')
        }
      } catch (error: any) {
        console.error('创建项目失败:', error)
        ms.error(error.message || '项目创建失败，请检查网络连接')
      }
    }
    
    if (success) {
      showModal.value = false
      await loadProjects()
    }
  } catch (error: any) {
    ms.error(error.message || '操作失败')
  }
}


// 删除项目
const handleDelete = async (project: Project) => {
  if (!project.id) return

  try {
    try {
      const response = await deleteProject(project.id)
      if (response && response.code === 200) {
        ms.success('项目删除成功')
        await loadProjects()
      } else {
        ms.error(response?.msg || '项目删除失败')
      }
    } catch (error: any) {
      console.error('删除项目失败:', error)
      ms.error(error.message || '项目删除失败，请检查网络连接')
    }
  } catch (error: any) {
    ms.error(error.message || '删除失败')
  }
}


// 查看项目任务
const viewProjectTasks = (project: Project) => {
  if (project.id) {
    router.push({
      path: '/task/index',
      query: { projectId: String(project.id) }
    })
  }
}

// 归档项目
const archiveProject = async (project: Project) => {
  if (!project.id) return

  try {
    const projectData: any = {
      status: ProjectStatus.ARCHIVED
    }
    
    try {
      const response = await updateProject(project.id, projectData)
      if (response && response.code === 200) {
        ms.success('项目已归档')
        await loadProjects()
      } else {
        ms.error(response?.msg || '项目归档失败')
      }
    } catch (error: any) {
      console.error('归档项目失败:', error)
      ms.error(error.message || '项目归档失败，请检查网络连接')
    }
  } catch (error: any) {
    ms.error(error.message || '归档失败')
  }
}

// 筛选变化
const handleFilterChange = () => {
  pagination.value.page = 1
  loadProjects()
}

// 表格列定义
const columns = [
  {
    title: '项目名称',
    key: 'name',
    width: 200,
    ellipsis: {
      tooltip: true
    },
    render: (row: Project) => {
      return h(NButton, {
        text: true,
        type: 'primary',
        onClick: () => viewProjectTasks(row)
      }, { default: () => row.name })
    }
  },
  {
    title: '描述',
    key: 'description',
    width: 250,
    ellipsis: {
      tooltip: true
    },
    render: (row: Project) => row.description || '-'
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row: Project) => {
      if (!row.status) return '-'
      return h(NTag, {
        type: statusTagType(row.status) as any,
        size: 'small'
      }, { default: () => statusLabel(row.status!) })
    }
  },
  {
    title: '任务数量',
    key: 'taskCount',
    width: 120,
    render: (row: Project) => {
      return h(NStatistic, {
        value: row.taskCount || 0,
        label: '总任务',
        size: 'small'
      })
    }
  },
  {
    title: '已完成',
    key: 'completedTaskCount',
    width: 120,
    render: (row: Project) => {
      return h(NStatistic, {
        value: row.completedTaskCount || 0,
        label: '已完成',
        size: 'small'
      })
    }
  },
  {
    title: '创建人',
    key: 'createdBy',
    width: 120,
    render: (row: Project) => row.createdBy || '-'
  },
  {
    title: '创建部门',
    key: 'createdByDept',
    width: 120,
    render: (row: Project) => row.createdByDept || '-'
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 150,
    render: (row: Project) => row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-'
  },
  {
    title: '操作',
    key: 'actions',
    width: 320,
    render: (row: Project) => {
      const canArchive = row.status !== ProjectStatus.ARCHIVED
      return h(NSpace, { size: 'small' }, {
        default: () => [
          h(NButton, {
            size: 'small',
            type: 'info',
            onClick: () => viewProjectTasks(row)
          }, {
            icon: () => h(NIcon, null, { default: () => h(ListOutline) }),
            default: () => '查看任务'
          }),
          h(NButton, {
            size: 'small',
            type: 'primary',
            onClick: () => openEditModal(row)
          }, {
            icon: () => h(NIcon, null, { default: () => h(CreateOutline) }),
            default: () => '编辑'
          }),
          canArchive ? h(NPopconfirm, {
            onPositiveClick: () => archiveProject(row)
          }, {
            trigger: () => h(NButton, {
              size: 'small',
              type: 'warning',
              onClick: () => {}
            }, {
              icon: () => h(NIcon, null, { default: () => h(ArchiveOutline) }),
              default: () => '归档'
            }),
            default: () => '确定要归档这个项目吗？归档后项目将不再显示在默认列表中。'
          }) : null,
          h(NPopconfirm, {
            onPositiveClick: () => handleDelete(row)
          }, {
            trigger: () => h(NButton, {
              size: 'small',
              type: 'error',
              onClick: () => {}
            }, {
              icon: () => h(NIcon, null, { default: () => h(TrashOutline) })
            }),
            default: () => '确定要删除这个项目吗？删除后无法恢复！'
          })
        ]
      })
    }
  }
]

onMounted(() => {
  loadProjects()
})
</script>

<template>
  <NMessageProvider>
    <div class="h-full flex flex-col p-4 dark:bg-[#24272e]">
      <NCard class="flex-1 flex flex-col" title="项目管理">
        <template #header-extra>
          <NButton type="primary" @click="openCreateModal">
            <template #icon>
              <NIcon><AddOutline /></NIcon>
            </template>
            创建项目
          </NButton>
        </template>

        <div class="mb-4">
          <NGrid :cols="4" :x-gap="12">
            <NGridItem :span="2">
              <NInput
                v-model:value="searchKeyword"
                placeholder="搜索项目..."
                clearable
                @keyup.enter="loadProjects"
              >
                <template #prefix>
                  <NIcon><SvgIcon icon="ri:search-line" /></NIcon>
                </template>
              </NInput>
            </NGridItem>
            <NGridItem>
              <NSelect
                v-model:value="filterStatus"
                placeholder="筛选状态"
                clearable
                :options="statusOptions"
                @update:value="handleFilterChange"
              />
            </NGridItem>
            <NGridItem>
              <NButton @click="loadProjects" type="primary" block>
                刷新
              </NButton>
            </NGridItem>
          </NGrid>
        </div>

        <div class="flex-1 overflow-hidden">
          <NDataTable
            :columns="columns"
            :data="projects"
            :loading="loading"
            :pagination="pagination"
            :max-height="600"
            striped
          />
          <NEmpty v-if="!loading && projects.length === 0" description="暂无项目" />
        </div>
      </NCard>

      <!-- 创建/编辑项目模态框 -->
      <NModal
        v-model:show="showModal"
        :title="isEdit ? '编辑项目' : '创建项目'"
        preset="dialog"
        style="width: 600px"
      >
        <NForm :model="currentProject" label-placement="left" label-width="80">
          <NFormItem label="项目名称" required>
            <NInput v-model:value="currentProject.name" placeholder="请输入项目名称" />
          </NFormItem>
          <NFormItem label="项目描述">
            <NInput
              v-model:value="currentProject.description"
              type="textarea"
              placeholder="请输入项目描述"
              :rows="4"
            />
          </NFormItem>
          <NFormItem label="创建人" v-if="!isEdit">
            <NInput
              v-model:value="currentProject.createdBy"
              placeholder="请输入创建人姓名"
            />
            <NText depth="3" style="font-size: 12px; margin-top: 4px; display: block;">
              默认：{{ currentUser.nickName || currentUser.userName || '当前登录用户' }}
            </NText>
          </NFormItem>
          <NFormItem label="创建人" v-else>
            <NInput
              :value="currentProject.createdBy || '-'"
              disabled
            />
          </NFormItem>
          <NFormItem label="创建部门" v-if="!isEdit">
            <NInput
              v-model:value="currentProject.createdByDept"
              placeholder="请输入创建部门"
            />
            <NText depth="3" style="font-size: 12px; margin-top: 4px; display: block;">
              默认：{{ currentUser.deptName || '当前用户部门' }}
            </NText>
          </NFormItem>
          <NFormItem label="创建部门" v-else>
            <NInput
              :value="currentProject.createdByDept || '-'"
              disabled
            />
          </NFormItem>
        </NForm>
        <template #action>
          <NSpace>
            <NButton @click="showModal = false">取消</NButton>
            <NButton type="primary" @click="saveProject">保存</NButton>
          </NSpace>
        </template>
      </NModal>
    </div>
  </NMessageProvider>
</template>

<style scoped>
:deep(.n-data-table) {
  height: 100%;
}
</style>

