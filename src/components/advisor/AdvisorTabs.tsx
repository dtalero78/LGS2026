'use client'

import { useState } from 'react'
import AdvisorCalendar from './AdvisorCalendar'
import AdvisorStats from './AdvisorStats'

interface AdvisorTabsProps {
  advisorId: string
  advisorName: string
}

type TabType = 'schedule' | 'stats'

export default function AdvisorTabs({ advisorId, advisorName }: AdvisorTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('schedule')

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'schedule'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            📅 Agendamiento
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'stats'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            📋 Eventos
          </button>
        </nav>
      </div>

      <div className="pt-4">
        {activeTab === 'schedule' && (
          <AdvisorCalendar advisorId={advisorId} advisorName={advisorName} />
        )}
        {activeTab === 'stats' && (
          <AdvisorStats advisorId={advisorId} advisorName={advisorName} />
        )}
      </div>
    </div>
  )
}