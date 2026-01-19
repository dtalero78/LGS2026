'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface StudentChangeStepProps {
  studentId: string;
  numeroId: string;
  currentStep: string;
  currentNivel: string;
  studentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface StepOption {
  label: string;
  value: string;
}

export default function StudentChangeStep({
  studentId,
  numeroId,
  currentStep,
  currentNivel,
  studentName,
  onClose,
  onSuccess
}: StudentChangeStepProps) {
  const [selectedStep, setSelectedStep] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [stepOptions, setStepOptions] = useState<StepOption[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);

  // Cargar TODOS los steps de TODOS los niveles desde Wix al montar el componente
  useEffect(() => {
    const fetchAllSteps = async () => {
      try {
        setLoadingSteps(true);
        const response = await fetch('/api/wix-proxy/niveles');

        if (!response.ok) {
          throw new Error('Error al cargar los niveles');
        }

        const data = await response.json();

        if (data.success && data.niveles) {
          // Extraer TODOS los steps de TODOS los niveles
          const allSteps: StepOption[] = [];

          data.niveles.forEach((nivel: any) => {
            if (nivel.steps && Array.isArray(nivel.steps)) {
              nivel.steps.forEach((step: string) => {
                // Evitar duplicados
                const stepNumber = step.replace('Step ', '');
                if (!allSteps.find(s => s.value === stepNumber)) {
                  allSteps.push({
                    label: step,
                    value: stepNumber
                  });
                }
              });
            }
          });

          // Ordenar los steps numéricamente
          allSteps.sort((a, b) => Number(a.value) - Number(b.value));

          setStepOptions(allSteps);
          console.log(`✅ Cargados ${allSteps.length} steps de todos los niveles`);
        } else {
          throw new Error('No se encontraron niveles');
        }
      } catch (err) {
        console.error('❌ Error cargando steps:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar los steps');
      } finally {
        setLoadingSteps(false);
      }
    };

    fetchAllSteps();
  }, []); // Sin dependencias - solo se ejecuta una vez al montar

  const handleUpdateStep = async () => {
    if (!selectedStep) {
      setError('Debes seleccionar un nuevo Step');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch('/api/wix-proxy/update-student-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numeroId: numeroId,
          newStep: selectedStep,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al actualizar el step');
      }

      console.log('✅ Step actualizado exitosamente:', data);
      setSuccess(true);

      // Esperar 1.5 segundos antes de cerrar y refrescar
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (err) {
      console.error('❌ Error al actualizar step:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Cambiar Step</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
            disabled={isUpdating}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Información del estudiante */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">{studentName}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Nivel actual:</span> {currentNivel}</p>
              <p><span className="font-medium">Step actual:</span> {currentStep}</p>
            </div>
          </div>

          {/* Selector de Step */}
          <div className="mb-6">
            <label htmlFor="newStep" className="block text-sm font-medium text-gray-700 mb-2">
              Nuevo Step
            </label>
            {loadingSteps ? (
              <div className="flex items-center justify-center py-3 px-3 border border-gray-300 rounded-md bg-gray-50">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-gray-600">Cargando steps...</span>
              </div>
            ) : (
              <select
                id="newStep"
                value={selectedStep}
                onChange={(e) => setSelectedStep(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isUpdating}
              >
                <option value="">Selecciona un Step</option>
                {stepOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Advertencia */}
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Advertencia:</p>
                <p>
                  Esta acción actualizará el Step y el Nivel del estudiante en las tablas ACADEMICA y PEOPLE.
                  El nuevo Nivel se asignará automáticamente según el Step seleccionado.
                </p>
              </div>
            </div>
          </div>

          {/* Mensaje de éxito */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mr-3" />
                <p className="text-sm text-green-800 font-medium">
                  Step actualizado exitosamente
                </p>
              </div>
            </div>
          )}

          {/* Mensaje de error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            disabled={isUpdating}
          >
            Cancelar
          </button>
          <button
            onClick={handleUpdateStep}
            disabled={isUpdating || !selectedStep || success || loadingSteps}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isUpdating ? 'Actualizando...' : success ? 'Actualizado ✓' : 'Actualizar Step'}
          </button>
        </div>
      </div>
    </div>
  );
}
