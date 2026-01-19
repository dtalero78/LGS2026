'use client'

import { useState } from 'react'
import { Person, FinancialData, Beneficiary } from '@/types'
import { cn } from '@/lib/utils'
import PersonGeneral from './PersonGeneral'
import PersonContact from './PersonContact'
import PersonFinancial from './PersonFinancial'
import PersonAdmin from './PersonAdmin'
import PersonComments from './PersonComments'

interface PersonTabsProps {
  person: Person
  financialData?: FinancialData
  beneficiaries: Beneficiary[]
}

const tabs = [
  { id: 'general', name: 'Información General', icon: 'ℹ️' },
  { id: 'contact', name: 'Contacto y Referencias', icon: '📞' },
  { id: 'financial', name: 'Financiera', icon: '💰' },
  { id: 'admin', name: 'Administración', icon: '⚙️' },
  { id: 'comments', name: 'Comentarios', icon: '💬' },
]

export default function PersonTabs({ person, financialData, beneficiaries }: PersonTabsProps) {
  const [activeTab, setActiveTab] = useState('general')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <PersonGeneral person={person} />
      case 'contact':
        return <PersonContact person={person} />
      case 'financial':
        return <PersonFinancial person={person} financialData={financialData} />
      case 'admin':
        return <PersonAdmin person={person} beneficiaries={beneficiaries} />
      case 'comments':
        return <PersonComments personId={person._id} />
      default:
        return <PersonGeneral person={person} />
    }
  }

  return (
    <div className="card">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm",
                activeTab === tab.id
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {renderTabContent()}
      </div>
    </div>
  )
}