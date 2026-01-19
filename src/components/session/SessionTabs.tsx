'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  InformationCircleIcon,
  UserGroupIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

interface SessionTabsProps {
  children: {
    general: React.ReactNode
    students: React.ReactNode
    material: React.ReactNode
  }
}

const tabs = [
  {
    id: 'general',
    name: 'Información General',
    icon: InformationCircleIcon,
    color: 'text-blue-600',
    activeColor: 'border-blue-500 text-blue-600'
  },
  {
    id: 'students',
    name: 'Estudiantes',
    icon: UserGroupIcon,
    color: 'text-purple-600',
    activeColor: 'border-purple-500 text-purple-600'
  },
  {
    id: 'material',
    name: 'Material',
    icon: DocumentTextIcon,
    color: 'text-emerald-600',
    activeColor: 'border-emerald-500 text-emerald-600'
  },
]

export default function SessionTabs({ children }: SessionTabsProps) {
  const [activeTab, setActiveTab] = useState('students')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return children.general
      case 'students':
        return children.students
      case 'material':
        return children.material
      default:
        return children.students
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200 px-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    activeTab === tab.id
                      ? tab.activeColor
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </div>
  )
}
