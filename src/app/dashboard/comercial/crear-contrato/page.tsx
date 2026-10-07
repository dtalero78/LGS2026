'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PermissionGuard } from '@/components/permissions'
import { ComercialPermission } from '@/types/permissions'
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { COUNTRY_CODES } from '@/lib/country-codes'
import KidsBeneficiarioModal, { KidsData } from '@/components/comercial/KidsBeneficiarioModal'

// Country prefixes — catálogo completo compartido (país de residencia + prefijo derivado).
const COUNTRY_PREFIXES = [
  ...COUNTRY_CODES.map(c => ({ country: c.pais, prefix: c.prefijo })),
  { country: "Otro", prefix: "" },
];

// Payment method options by country
const PAYMENT_OPTIONS: Record<string, { label: string; value: string }[]> = {
  "Colombia": [
    { label: "Transferencia", value: "Transferencia" },
    { label: "Epayco", value: "Epayco" },
    { label: "Paypal", value: "Paypal" }
  ],
  "Ecuador": [
    { label: "Transferencia", value: "Transferencia" },
    { label: "Datafast", value: "Datafast" },
    { label: "Paypal", value: "Paypal" }
  ],
  "Chile": [
    { label: "Transferencia", value: "Transferencia" },
    { label: "Webpay", value: "Webpay" },
    { label: "Paypal", value: "Paypal" }
  ],
  "Perú": [
    { label: "Transferencia", value: "Transferencia" },
    { label: "Niubiz", value: "Niubiz" }
  ]
};

const DRAFT_KEY = 'crear-contrato-draft'

// ── Verificación de documentos (ver /api/postgres/contracts/verificar-documento) ──
type SituacionDoc = 'APROBADO' | 'FIRMADO_SIN_APROBAR' | 'SIN_FIRMAR'
interface RegDoc {
  personId: string; tipoUsuario: string; contrato: string; nombre: string
  situacion: SituacionDoc; firmado: boolean; titularId: string | null
  titularNombre: string | null; pagosValidados: number; creado: string | null
}
type RolVerif = 'TITULAR_SI' | 'TITULAR_NO' | 'BENEFICIARIO'
interface VerifItem { quien: string; numeroId: string; registros: RegDoc[] }
interface VerifState {
  kind: 'titular' | 'beneficiarios'
  items: VerifItem[]
  datosPrevios?: any
  // Antecedentes INFORMATIVOS del titular (no bloquean): contratos anulados/
  // rechazados/devueltos con sus pagos validados, y ficha académica previa.
  previos?: { contrato: string; tipoUsuario: string; estado: string; pagosValidados: number }[]
  academica?: { nivel: string | null; step: string | null; clases: number } | null
  lista?: any[]          // beneficiarios a confirmar (kind='beneficiarios')
  error?: string
}

/**
 * Matriz acordada (2026-10-05). Firmado/sin firmar solo cambia el texto:
 *  - Beneficiario en contrato APROBADO: SÍ/beneficiario → BLOQUEO · NO → info
 *  - Beneficiario en contrato PENDIENTE: SÍ/beneficiario → RESOLVER · NO → info
 *  - Titular en contrato APROBADO → info (+ "Traer sus datos")
 *  - Titular en contrato PENDIENTE → RESOLVER (ir al anterior / anular el anterior)
 *  - Para un BENEFICIARIO del paso 7 solo cuentan sus filas de beneficiario.
 */
function clasificar(registros: RegDoc[], rol: RolVerif) {
  const esBenef = (r: RegDoc) => r.tipoUsuario !== 'TITULAR'
  const aprob = (r: RegDoc) => r.situacion === 'APROBADO'
  const bloqueos: RegDoc[] = []
  const porResolver: RegDoc[] = []
  const info: RegDoc[] = []
  for (const r of registros) {
    if (esBenef(r)) {
      if (rol === 'TITULAR_NO') info.push(r)
      else if (aprob(r)) bloqueos.push(r)
      else porResolver.push(r)
    } else if (rol !== 'BENEFICIARIO') {
      if (aprob(r)) info.push(r)
      else porResolver.push(r)
    }
  }
  return { bloqueos, porResolver, info }
}

const SITUACION_TXT: Record<SituacionDoc, string> = {
  APROBADO: 'aprobado',
  FIRMADO_SIN_APROBAR: 'firmado y no aprobado',
  SIN_FIRMAR: 'sin firmar y no aprobado',
}
const DRAFT_TTL_MS = 72 * 60 * 60 * 1000 // 72 horas

interface Beneficiario {
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  numeroId: string;
  fechaNacimiento: string;
  email?: string;
  celular?: string;
  sence?: boolean; // Usuario SENCE (solo contratos de Chile)
  senceCode?: string; // Código SENCE del beneficiario (opcional, si sence)
  kids?: boolean; // Segmento/programa infantil (PEOPLE.kids)
  kidsData?: KidsData; // Datos de inscripción kids (curso + apoderado) → KIDS_INSCRIPCIONES
}

export default function CrearContratoPage() {
  return (
    <Suspense fallback={null}>
      <CrearContratoContent />
    </Suspense>
  );
}

function CrearContratoContent() {
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  // Form data
  const [titular, setTitular] = useState({
    asesor: searchParams.get('email') || '',
    // Nombre y apellido del asesor tal como vienen del CRM (via bridge) →
    // se guarda en PEOPLE.asesorCreadorContrato. `asesor` sigue siendo el email.
    asesorCreadorContrato: [searchParams.get('nombre'), searchParams.get('apellido')]
      .filter(Boolean)
      .join(' '),
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    numeroId: '',
    tipoPersona: 'Persona Natural', // 'Persona Natural' | 'Empresa'
    // Representante legal (solo modo Empresa) → PEOPLE.replegal / replegalid / replegalcel
    // Rubro / giro — SOLO modo Empresa. Va en el contrato entre NIT/RUT y Domicilio.
    rubro: '',
    replegal: '',
    replegalcargo: '',
    replegalid: '',
    replegalcel: '',
    plataforma: '',
    fechaNacimiento: '',
    pais: 'Colombia',
    domicilio: '',
    ciudad: '',
    celular: '',
    telefono: '',
    ingresos: '',
    email: '',
    empresa: '',
    cargo: '',
    genero: '',
    referenciaUno: '',
    parentezcoRefUno: '',
    telRefUno: '',
    referenciaDos: '',
    parentezcoRefDos: '',
    telRefDos: ''
  });

  const [financial, setFinancial] = useState({
    totalPlan: 0,
    pagoInscripcion: 0,
    saldo: 0,
    numeroCuotas: 0,
    tipoPlan: '' as '' | 'Contado' | 'Credito' | 'Colaborador' | 'Empresa',
    valorCuota: 0,
    fechaPago: '',
    vigencia: '',
    medioPago: ''
  });

  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  // Índice del beneficiario cuyo modal Kids está abierto (null = cerrado).
  const [kidsModalIndex, setKidsModalIndex] = useState<number | null>(null);
  // Flag del proceso Kids (APP_CONFIG, togglable desde Mantenimiento › Proceso Kids).
  const [kidsFeatureEnabled, setKidsFeatureEnabled] = useState(false);
  useEffect(() => {
    fetch('/api/admin/kids-config')
      .then(r => r.json())
      .then(d => setKidsFeatureEnabled(!!d.active))
      .catch(() => setKidsFeatureEnabled(false));
  }, []);
  // En modo Empresa el país del titular se toma de la plataforma (no se pregunta).
  const [titularEsBeneficiario, setTitularEsBeneficiario] = useState(false);
  // Respuesta explícita SÍ/NO a "¿El titular será beneficiario?" — OBLIGATORIA
  // (null = sin responder). SÍ equivale a la antigua casilla marcada.
  const [titularBenefRespuesta, setTitularBenefRespuesta] = useState<'SI' | 'NO' | null>(null);
  const elegirTitularBenef = (v: 'SI' | 'NO' | null) => {
    setTitularBenefRespuesta(v);
    setTitularEsBeneficiario(v === 'SI');
  };
  // SENCE: marca a nivel del titular (empresa) — solo se activa si es
  // Empresa y de Chile. El código SENCE NO se captura aquí; se captura por
  // beneficiario en el paso 7.
  const [senceUsuario, setSenceUsuario] = useState(false);
  const [contrato, setContrato] = useState('');
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  // Contrato de prueba: prefijo PRB- en el número, no afecta el consecutivo
  // real, queda visible con badge naranja y se descarta de informes.
  const [esContratoPrueba, setEsContratoPrueba] = useState(false);
  // Confirmación al salir del paso 2 si el titular NO está marcado como beneficiario
  // ── Verificación de documentos (titular en el paso 2, beneficiarios al crear) ──
  // Consulta en qué OTROS contratos vivos aparece cada documento y obliga a
  // resolver los conflictos ANTES de seguir. El número de contrato se asigna
  // en el servidor DESPUÉS de esta verificación.
  const [verif, setVerif] = useState<VerifState | null>(null);
  const [verifLoading, setVerifLoading] = useState(false);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);
  const [traerDatosMsg, setTraerDatosMsg] = useState('');
  // Confirmación al CREAR si nadie tomará clases (sin beneficiarios y titular no beneficiario)
  const [showNoBenefConfirm, setShowNoBenefConfirm] = useState(false);
  // Protección de historial: beneficiarios (o el titular-beneficiario) del contrato
  // recién creado cuyo numeroId ya tenía ficha académica de un contrato anterior.
  const [proteccionCasos, setProteccionCasos] = useState<Array<{ numeroId: string; contratoViejo: string | null; bookings: number; nombre: string }>>([]);
  const [proteccionCtx, setProteccionCtx] = useState<{ titularId: string; contratoNuevo: string } | null>(null);
  const [protegiendoIdx, setProtegiendoIdx] = useState<number | null>(null);
  const [proteccionError, setProteccionError] = useState<string>('');
  // Confirmación al crear cuando SÍ hay beneficiarios o el titular es beneficiario.
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  // Confirmación al ACTIVAR SENCE: el comercial debe declarar que el usuario
  // está (o estará) inscrito en SENCE antes de marcar el contrato.
  const [showSenceConfirm, setShowSenceConfirm] = useState(false);
  // Aviso de beneficiario(s) en blanco (sin datos) al intentar crear.
  const [showBlankBenefWarning, setShowBlankBenefWarning] = useState(false);
  const draftRestored = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // Auto-save draft to localStorage (debounced 500ms)
  useEffect(() => {
    if (!draftRestored.current) return // Don't save until initial load is done
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          titular, financial, beneficiarios, titularEsBeneficiario, titularBenefRespuesta, senceUsuario, currentStep, contrato, esContratoPrueba,
          savedAt: Date.now()
        }))
      } catch {}
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [titular, financial, beneficiarios, titularEsBeneficiario, titularBenefRespuesta, senceUsuario, currentStep, contrato, esContratoPrueba])

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.savedAt && Date.now() - draft.savedAt < DRAFT_TTL_MS) {
          setShowDraftBanner(true)
          // Store draft temporarily so we can restore on accept
          draftRestored.current = false
          ;(window as any).__contractDraft = draft
        } else {
          localStorage.removeItem(DRAFT_KEY)
          draftRestored.current = true
        }
      } else {
        draftRestored.current = true
      }
    } catch {
      draftRestored.current = true
    }
  }, [])

  const restoreDraft = () => {
    const draft = (window as any).__contractDraft
    if (draft) {
      if (draft.titular) setTitular(draft.titular)
      if (draft.financial) setFinancial(draft.financial)
      if (draft.beneficiarios) setBeneficiarios(draft.beneficiarios)
      if (draft.titularBenefRespuesta === 'SI' || draft.titularBenefRespuesta === 'NO') {
        elegirTitularBenef(draft.titularBenefRespuesta)
      } else if (draft.titularEsBeneficiario === true) {
        // Borrador de la versión con casilla: marcada = SÍ; sin marcar = sin responder.
        elegirTitularBenef('SI')
      }
      if (draft.senceUsuario !== undefined) setSenceUsuario(draft.senceUsuario)
      if (draft.currentStep) setCurrentStep(draft.currentStep)
      // draft.contrato se ignora: el número lo asigna el servidor al crear.
      if (draft.esContratoPrueba !== undefined) setEsContratoPrueba(draft.esContratoPrueba)
      delete (window as any).__contractDraft
    }
    setShowDraftBanner(false)
    draftRestored.current = true
  }

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    delete (window as any).__contractDraft
    setShowDraftBanner(false)
    draftRestored.current = true
  }

  // El NÚMERO DE CONTRATO ya no se pre-asigna en el formulario: lo asigna el
  // servidor al crear (después de las verificaciones), dentro de una transacción
  // con bloqueo por país/año — así no se muestra un número que pueda quedar
  // desactualizado ni se repiten números entre comerciales simultáneos.

  // Get phone prefix based on selected country (without '+')
  const getPhonePrefix = () => {
    const countryData = COUNTRY_PREFIXES.find(c => c.country === titular.pais);
    return (countryData?.prefix || '').replace(/\+/g, '').replace(/\s/g, '');
  };

  // Get payment options based on selected country
  const getPaymentOptions = () => {
    return PAYMENT_OPTIONS[titular.pais] || PAYMENT_OPTIONS['Colombia'];
  };

  // Calculate balance when total or down payment changes
  const calculateBalance = (totalPlan?: number, pagoInscripcion?: number) => {
    const total = totalPlan !== undefined ? totalPlan : (Number(financial.totalPlan) || 0);
    const downPayment = pagoInscripcion !== undefined ? pagoInscripcion : (Number(financial.pagoInscripcion) || 0);
    const balance = total - downPayment;

    setFinancial(prev => ({
      ...prev,
      saldo: balance
    }));

    // Recalcular valor de cuota con el nuevo saldo
    calculateInstallmentValue(balance, financial.numeroCuotas);
  };

  // Calculate installment value
  const calculateInstallmentValue = (saldo?: number, numeroCuotas?: number) => {
    const balance = saldo !== undefined ? saldo : (Number(financial.saldo) || 0);
    const numInstallments = numeroCuotas !== undefined ? numeroCuotas : (Number(financial.numeroCuotas) || 0);

    if (numInstallments > 0) {
      const installmentValue = balance / numInstallments;
      setFinancial(prev => ({
        ...prev,
        valorCuota: Math.round(installmentValue)
      }));
    } else {
      setFinancial(prev => ({
        ...prev,
        valorCuota: 0
      }));
    }
  };

  // Format number with thousand separators
  const formatNumber = (value: string | number): string => {
    const num = typeof value === 'string' ? value.replace(/\D/g, '') : value.toString();
    return Number(num).toLocaleString('es-CO');
  };

  // Handle numeric field change
  const handleNumericChange = (field: string, value: string, setter: any) => {
    const numericValue = value.replace(/\D/g, '');
    setter((prev: any) => ({
      ...prev,
      [field]: Number(numericValue)
    }));
  };

  // Add beneficiario
  const addBeneficiario = () => {
    // Propaga la marca SENCE del titular (Empresa + Chile + marcada)
    // → el nuevo beneficiario nace con sence=true (editable por fila).
    const heredaSence = senceUsuario && titular.tipoPersona === 'Empresa' && titular.plataforma === 'Chile'
    setBeneficiarios([...beneficiarios, {
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      numeroId: '',
      fechaNacimiento: '',
      email: '',
      celular: '',
      sence: heredaSence,
      kids: false
    }]);
  };

  // Remove beneficiario
  const removeBeneficiario = (index: number) => {
    setBeneficiarios(beneficiarios.filter((_, i) => i !== index));
  };

  // Modal Kids: reúne TODOS los datos del beneficiario (regulares + curso + apoderado).
  const saveKidsModal = (v: any) => {
    if (kidsModalIndex === null) return
    const upd = [...beneficiarios]
    upd[kidsModalIndex] = { ...upd[kidsModalIndex], ...v, kids: true }
    setBeneficiarios(upd)
    setKidsModalIndex(null)
  }
  const cancelKidsModal = () => {
    // Si se encendió el switch pero no se guardaron datos, revertir a no-kids.
    if (kidsModalIndex !== null && !beneficiarios[kidsModalIndex]?.kidsData) {
      const upd = [...beneficiarios]
      upd[kidsModalIndex] = { ...upd[kidsModalIndex], kids: false }
      setBeneficiarios(upd)
    }
    setKidsModalIndex(null)
  }

  // Update beneficiario
  const updateBeneficiario = (index: number, field: string, value: string) => {
    const updatedBeneficiarios = [...beneficiarios];
    updatedBeneficiarios[index] = {
      ...updatedBeneficiarios[index],
      [field]: value
    };
    setBeneficiarios(updatedBeneficiarios);
  };

  // Modo Empresa: cambia el formato del titular a lo largo del wizard.
  const esEmpresa = titular.tipoPersona === 'Empresa';

  // Nombre del titular para el encabezado persistente (empresa = razón social).
  const nombreTitular = [titular.primerNombre, titular.segundoNombre, titular.primerApellido, titular.segundoApellido]
    .filter(Boolean).join(' ').trim();

  // En modo Empresa, el país del titular = plataforma.
  useEffect(() => {
    if (esEmpresa && titular.plataforma && titular.pais !== titular.plataforma) {
      setTitular(t => ({ ...t, pais: t.plataforma }));
    }
  }, [esEmpresa, titular.plataforma, titular.pais]);

  // Validate current step
  // Email válido: contiene @ con texto antes/después + dominio con punto, y SIN
  // espacios (el regex rechaza cualquier espacio, incluidos inicio/fin).
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        // Nombre del asesor + su email (válido). El email es la llave que
        // resuelve al comercial contra USUARIOS_ROLES.
        return titular.asesorCreadorContrato.trim() !== '' &&
               titular.asesor !== '' &&
               isValidEmail(titular.asesor);
      case 2:
        if (esEmpresa) {
          // Empresa: nombre empresa + RUT fiscal + rep. legal (los 3 campos).
          return titular.primerNombre !== '' &&
                 titular.numeroId !== '' &&
                 titular.plataforma !== '' &&
                 titular.replegal.trim() !== '' &&
                 titular.replegalcargo.trim() !== '' &&
                 titular.replegalid.trim() !== '' &&
                 titular.replegalcel.trim() !== '';
        }
        return titular.primerNombre !== '' &&
               titular.primerApellido !== '' &&
               titular.numeroId !== '' &&
               titular.plataforma !== '' &&
               titularBenefRespuesta !== null; // SÍ/NO obligatorio
      case 3:
        if (esEmpresa) {
          // Empresa: sin fecha de nacimiento, país = plataforma, se pide el correo.
          return isValidEmail(titular.email) &&
                 titular.domicilio !== '' &&
                 titular.ciudad !== '' &&
                 titular.celular !== '';
        }
        return titular.fechaNacimiento !== '' &&
               titular.pais !== '' &&
               titular.domicilio !== '' &&
               titular.ciudad !== '' &&
               titular.celular !== '';
      case 4:
        return titular.ingresos !== '' &&
               isValidEmail(titular.email) &&
               titular.genero !== '';
      case 5:
        // Ambas referencias son obligatorias (nombre + parentesco + teléfono).
        return titular.referenciaUno !== '' &&
               titular.parentezcoRefUno !== '' &&
               titular.telRefUno !== '' &&
               titular.referenciaDos !== '' &&
               titular.parentezcoRefDos !== '' &&
               titular.telRefDos !== '';
      case 6:
        return financial.totalPlan > 0 &&
               financial.pagoInscripcion >= 0 &&
               financial.fechaPago !== '' &&
               financial.vigencia !== '' &&
               financial.medioPago !== '';
      default:
        return true;
    }
  };

  // Avanza un paso (con el cálculo de saldo al salir del paso 3).
  const advanceStep = () => {
    if (currentStep === 3) {
      calculateBalance();
    }
    if (currentStep < 7) {
      // En modo Empresa se omite el paso 4 (Adicional): salta 3 → 5.
      const next = (esEmpresa && currentStep === 3) ? 5 : currentStep + 1;
      setCurrentStep(next);
    }
  };

  // Handle next button
  const handleNext = () => {
    if (!validateStep(currentStep)) {
      // Mensaje específico para email inválido (paso 4 en Natural, paso 3 en Empresa).
      const emailStepMalo =
        (currentStep === 4 && !esEmpresa && titular.email !== '' && !isValidEmail(titular.email)) ||
        (currentStep === 3 && esEmpresa && titular.email !== '' && !isValidEmail(titular.email));
      if (emailStepMalo) {
        setError('El correo no es válido. Debe contener @ (correo@dominio.com) y no llevar espacios.');
      } else if (currentStep === 2 && !esEmpresa && titularBenefRespuesta === null) {
        setError('Indica si el titular será beneficiario: marca SÍ o NO (campo obligatorio).');
      } else {
        setError('Por favor complete todos los campos requeridos');
      }
      return;
    }

    setError('');

    // Guard paso 2: VERIFICACIÓN DEL TITULAR (consulta la BD con su documento y
    // la respuesta SÍ/NO). Aplica también a Empresa (como titular).
    if (currentStep === 2) {
      abrirVerificacionTitular();
      return;
    }

    advanceStep();
  };

  const fetchVerificacion = async (numeroId: string, traerDatos = false) => {
    const qs = new URLSearchParams({ numeroId });
    if (traerDatos) qs.set('traerDatos', '1');
    const res = await fetch(`/api/postgres/contracts/verificar-documento?${qs}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `Error ${res.status} al verificar`);
    return json as { registros: RegDoc[]; datosPrevios?: any; previos?: VerifState['previos']; academica?: VerifState['academica'] };
  };

  const abrirVerificacionTitular = async () => {
    setVerifLoading(true);
    setTraerDatosMsg('');
    try {
      const r = await fetchVerificacion(titular.numeroId, true);
      setVerif({
        kind: 'titular',
        items: [{ quien: nombreCompletoTitular(), numeroId: titular.numeroId, registros: r.registros }],
        datosPrevios: r.datosPrevios || null,
        previos: r.previos || [],
        academica: r.academica || null,
      });
    } catch (e: any) {
      setVerif({ kind: 'titular', items: [], error: e?.message || 'No se pudo verificar' });
    } finally {
      setVerifLoading(false);
    }
  };

  const nombreCompletoTitular = () =>
    [titular.primerNombre, titular.segundoNombre, titular.primerApellido, titular.segundoApellido].filter(Boolean).join(' ');

  // Rol con que se evalúa cada documento: el titular según SÍ/NO; los beneficiarios como beneficiarios.
  const rolDeItem = (kind: VerifState['kind']): RolVerif =>
    kind === 'beneficiarios' ? 'BENEFICIARIO' : (titularEsBeneficiario && !esEmpresa ? 'TITULAR_SI' : 'TITULAR_NO');

  // Re-consulta un ítem (tras anular algo) para refrescar el modal.
  const refrescarItem = async (idx: number) => {
    if (!verif) return;
    const item = verif.items[idx];
    const r = await fetchVerificacion(item.numeroId);
    setVerif(v => v ? { ...v, items: v.items.map((it, i) => i === idx ? { ...it, registros: r.registros } : it) } : v);
  };

  const anularAnterior = async (idx: number, reg: RegDoc) => {
    const alcance = reg.tipoUsuario === 'TITULAR' ? 'CONTRATO' : 'REGISTRO';
    const txt = alcance === 'CONTRATO'
      ? `Se ANULARÁ el contrato ${reg.contrato} completo (titular y beneficiarios). Quedará como "Contrato nulo" y se depurará en la limpieza semanal. ¿Continuar?`
      : `Se ANULARÁ el registro de ${reg.nombre} en el contrato ${reg.contrato}. Quedará como "Contrato nulo" y se depurará en la limpieza semanal. ¿Continuar?`;
    if (!window.confirm(txt)) return;
    setAnulandoId(reg.personId);
    try {
      const res = await fetch('/api/postgres/contracts/anular-registro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: reg.personId, alcance }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || `Error ${res.status}`);
      await refrescarItem(idx);
    } catch (e: any) {
      alert(`No se pudo anular: ${e?.message || 'error'}`);
    } finally {
      setAnulandoId(null);
    }
  };

  const irAlContratoAnterior = (reg: RegDoc) => {
    if (!reg.titularId) return;
    if (!window.confirm(`Se descartará este formulario y se abrirá el contrato ${reg.contrato} para continuar gestionándolo. ¿Continuar?`)) return;
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    window.location.href = `/dashboard/comercial/contrato/${reg.titularId}`;
  };

  // "Traer sus datos": completa SOLO los campos vacíos del titular con los del
  // contrato anterior (nunca pisa lo que ya se escribió).
  const traerDatosPrevios = () => {
    const d = verif?.datosPrevios;
    if (!d) return;
    const prefijo = getPhonePrefix();
    const sinPrefijo = (v: string) => { const s = String(v || '').replace(/\D/g, ''); return prefijo && s.startsWith(prefijo) ? s.slice(prefijo.length) : s; };
    const fecha = (v: any) => { if (!v) return ''; const s = String(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : (new Date(s).toISOString?.().slice(0, 10) || ''); };
    const mapa: Array<[keyof typeof titular, any]> = [
      ['segundoNombre', d.segundoNombre], ['segundoApellido', d.segundoApellido],
      ['email', d.email], ['celular', d.celular ? sinPrefijo(d.celular) : ''], ['telefono', d.telefono],
      ['fechaNacimiento', fecha(d.fechaNacimiento)], ['domicilio', d.domicilio], ['ciudad', d.ciudad],
      ['genero', d.genero], ['empresa', d.empresa], ['cargo', d.cargo], ['ingresos', d.ingresos],
      ['referenciaUno', d.referenciaUno], ['parentezcoRefUno', d.parentezcoRefUno], ['telRefUno', d.telefonoRefUno],
      ['referenciaDos', d.referenciaDos], ['parentezcoRefDos', d.parentezcoRefDos], ['telRefDos', d.telefonoRefDos],
    ];
    let n = 0;
    const nuevo: any = { ...titular };
    for (const [k, v] of mapa) {
      if (v !== null && v !== undefined && String(v).trim() !== '' && String(nuevo[k] ?? '').trim() === '') {
        nuevo[k] = String(v).trim(); n++;
      }
    }
    setTitular(nuevo);
    setTraerDatosMsg(n > 0 ? `Se completaron ${n} campo(s) vacíos con los datos del contrato ${d.contrato}.` : 'No había campos vacíos por completar.');
  };

  // Verifica a los beneficiarios (paso 7) antes de la confirmación final.
  // Devuelve true si no hay conflictos; si los hay, abre el modal y devuelve false.
  const verificarBeneficiarios = async (lista: Beneficiario[]): Promise<boolean> => {
    const titularNid = (titular.numeroId || '').trim().toUpperCase();
    const aVerificar = lista.filter(b => (b.numeroId || '').trim() && (b.numeroId || '').trim().toUpperCase() !== titularNid);
    if (!aVerificar.length) return true;
    setVerifLoading(true);
    try {
      const items = await Promise.all(aVerificar.map(async b => {
        const r = await fetchVerificacion(b.numeroId);
        return { quien: `${b.primerNombre || ''} ${b.primerApellido || ''}`.trim() || b.numeroId, numeroId: b.numeroId, registros: r.registros };
      }));
      const conConflicto = items.filter(it => {
        const c = clasificar(it.registros, 'BENEFICIARIO');
        return c.bloqueos.length || c.porResolver.length;
      });
      if (!conConflicto.length) return true;
      setVerif({ kind: 'beneficiarios', items: conConflicto, lista });
      return false;
    } catch (e: any) {
      setVerif({ kind: 'beneficiarios', items: [], lista, error: e?.message || 'No se pudo verificar' });
      return false;
    } finally {
      setVerifLoading(false);
    }
  };

  // Handle previous button
  const handlePrevious = () => {
    setError('');
    if (currentStep > 1) {
      // En modo Empresa el paso 4 está omitido: 5 → 3.
      const prev = (esEmpresa && currentStep === 5) ? 3 : currentStep - 1;
      setCurrentStep(prev);
    }
  };

  // Guard del botón "Crear Contrato": si nadie tomará clases (sin beneficiarios
  // y titular no es beneficiario), confirma antes de crear.
  // Beneficiario "en blanco" = sin nombre, sin apellido y sin ID.
  const isBeneficiarioBlank = (b: Beneficiario) =>
    !(b.primerNombre || '').trim() && !(b.primerApellido || '').trim() && !(b.numeroId || '').trim();

  // Valida que ningún beneficiario repita el correo del titular ni de otro
  // beneficiario (BLOQUEANTE). Devuelve mensaje de error o null.
  const validarCorreosBeneficiarios = (lista: Beneficiario[]): string | null => {
    const norm = (s?: string) => (s || '').trim().toLowerCase();
    const titEmail = norm(titular.email);
    const vistos = new Set<string>();
    for (const b of lista) {
      const e = norm(b.email);
      if (!e) continue;
      const nombre = `${b.primerNombre || ''} ${b.primerApellido || ''}`.trim() || 'sin nombre';
      // Excepción: si se marcó "Titular será beneficiario", se permite que un
      // beneficiario tenga el mismo correo del titular.
      if (titEmail && e === titEmail && !titularEsBeneficiario) {
        return `El correo del beneficiario ${nombre} es el mismo del titular. Cada beneficiario debe tener un correo distinto.`;
      }
      if (vistos.has(e)) {
        return `Dos beneficiarios tienen el mismo correo (${b.email}). Cada beneficiario debe tener un correo distinto.`;
      }
      vistos.add(e);
    }
    return null;
  };

  // Beneficiarios cuyo celular coincide con el del titular (solo ADVERTENCIA).
  const benefsMismoCelularTitular = (lista: Beneficiario[]): Beneficiario[] => {
    const tc = (titular.celular || '').replace(/\D/g, '');
    if (!tc) return [];
    return lista.filter(b => {
      const bc = (b.celular || '').replace(/\D/g, '');
      return bc && bc === tc;
    });
  };

  // Continúa al flujo normal de confirmación con la lista dada de beneficiarios.
  const continuarConfirmacion = async (lista: Beneficiario[]) => {
    // Correos duplicados (titular o entre beneficiarios) → bloquea.
    const errCorreo = validarCorreosBeneficiarios(lista);
    if (errCorreo) { setError(errCorreo); return; }
    // Verificación de beneficiarios contra otros contratos vivos (bloquea si hay conflictos).
    if (!(await verificarBeneficiarios(lista))) return;
    abrirConfirmacionCreacion(lista);
  };

  const abrirConfirmacionCreacion = (lista: Beneficiario[]) => {
    if (lista.length === 0 && !titularEsBeneficiario) {
      setShowNoBenefConfirm(true);
    } else {
      setShowCreateConfirm(true);
    }
  };

  const handleSubmit = () => {
    // 1) ¿Hay beneficiario(s) en blanco? → avisar (llenar o borrar).
    if (beneficiarios.some(isBeneficiarioBlank)) {
      setShowBlankBenefWarning(true);
      return;
    }
    // 2) Flujo normal de confirmación.
    continuarConfirmacion(beneficiarios);
  };

  // "Borrar y continuar": elimina los beneficiarios en blanco y sigue al flujo.
  const descartarBlancosYContinuar = () => {
    const limpios = beneficiarios.filter(b => !isBeneficiarioBlank(b));
    setBeneficiarios(limpios);
    setShowBlankBenefWarning(false);
    continuarConfirmacion(limpios);
  };

  // Creación real del contrato.
  const doSubmit = async () => {
    setShowNoBenefConfirm(false);
    setShowCreateConfirm(false);
    setShowBlankBenefWarning(false);

    // Validación de correos (defensa también si vienen de un borrador guardado).
    if (titular.email !== '' && !isValidEmail(titular.email)) {
      setError('El correo del titular no es válido. Debe contener @ (correo@dominio.com) y no llevar espacios.');
      return;
    }
    const benefMailMalo = beneficiarios.find(b => (b.email ?? '').trim() !== '' && !isValidEmail((b.email ?? '').trim()));
    if (benefMailMalo) {
      setError(`El correo del beneficiario ${benefMailMalo.primerNombre || ''} no es válido. Debe contener @ y no llevar espacios.`);
      return;
    }
    // Correos duplicados (titular/entre beneficiarios) — bloquea (excepción: titular beneficiario).
    const errDupCorreo = validarCorreosBeneficiarios(beneficiarios);
    if (errDupCorreo) { setError(errDupCorreo); return; }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // YYYY-MM-DD en TZ local del navegador (evita corrimiento UTC al guardar fechaPago)
      const _now = new Date();
      const clientToday = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

      const response = await fetch('/api/postgres/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contrato,
          titular: {
            ...titular,
            celular: getPhonePrefix() + titular.celular,
            // Empresa: el país se toma de la plataforma (el paso 3 no pregunta país).
            pais: esEmpresa ? titular.plataforma : titular.pais
          },
          financial,
          beneficiarios: beneficiarios.map(b => ({
            ...b,
            celular: b.celular ? getPhonePrefix() + b.celular : null
          })),
          // Una empresa nunca es beneficiaria (no toma el programa).
          titularEsBeneficiario: esEmpresa ? false : titularEsBeneficiario,
          // SENCE del titular: Empresa + Chile (tipoPersona va dentro de `titular`).
          // El código NO se captura a nivel del titular — solo por beneficiario.
          sence: senceUsuario && titular.tipoPersona === 'Empresa' && titular.plataforma === 'Chile',
          clientToday,
          esContratoPrueba,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear el contrato');
      }

      const data = await response.json();
      setContractNumber(data.contractNumber);
      setSuccess(`Contrato creado exitosamente. Número de contrato: ${data.contractNumber}`);
      localStorage.removeItem(DRAFT_KEY);

      // ¿Alguno de los que tomarán el programa ya tenía ficha académica de un
      // contrato anterior? (beneficiarios + titular-beneficiario). Si sí, ofrecer
      // protección de historial ANTES de redirigir.
      const idsAChequear = new Set<string>();
      beneficiarios.forEach(b => { const n = (b.numeroId || '').trim(); if (n) idsAChequear.add(n); });
      if (titularEsBeneficiario) { const n = (titular.numeroId || '').trim(); if (n) idsAChequear.add(n); }

      const casos: Array<{ numeroId: string; contratoViejo: string | null; bookings: number; nombre: string }> = [];
      if (data._id && idsAChequear.size > 0) {
        await Promise.all(Array.from(idsAChequear).map(async (numId) => {
          try {
            const chk = await fetch(`/api/postgres/proteccion-historial/check?numeroId=${encodeURIComponent(numId)}&contratoNuevo=${encodeURIComponent(data.contractNumber || '')}`);
            const cd = await chk.json();
            if (cd?.success && cd.existeHistorial && cd.bookings > 0) {
              const ben = beneficiarios.find(b => (b.numeroId || '').trim() === numId);
              const nombre = ben
                ? `${ben.primerNombre || ''} ${ben.primerApellido || ''}`.trim()
                : `${titular.primerNombre || ''} ${titular.primerApellido || ''}`.trim();
              casos.push({ numeroId: numId, contratoViejo: cd.contratoViejo, bookings: cd.bookings, nombre });
            }
          } catch { /* si falla el check, no bloquea la creación */ }
        }));
      }

      if (casos.length > 0 && data._id) {
        const ctx = { titularId: data._id, contratoNuevo: data.contractNumber };
        setProteccionCasos(casos);
        setProteccionCtx(ctx);
        setLoading(false);
        protegerTodos(casos, ctx); // SIEMPRE se archiva; el modal muestra el progreso
        return; // el modal decide cuándo redirigir
      }

      // Redirect to contract detail page
      if (data._id) {
        setTimeout(() => {
          window.location.href = `/dashboard/comercial/contrato/${data._id}`;
        }, 2000);
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'Error al crear el contrato');
    } finally {
      setLoading(false);
    }
  };

  const irAlContrato = (titularId?: string) => {
    const id = titularId || proteccionCtx?.titularId;
    if (id) window.location.href = `/dashboard/comercial/contrato/${id}`;
  };

  // Archiva SIEMPRE el historial de cada caso (secuencial). Si un PDF falla,
  // detiene y muestra error con Reintentar / Continuar sin proteger.
  const protegerTodos = async (
    casos: Array<{ numeroId: string; contratoViejo: string | null; bookings: number; nombre: string }>,
    ctx: { titularId: string; contratoNuevo: string },
  ) => {
    setProteccionError('');
    for (let i = 0; i < casos.length; i++) {
      const caso = casos[i];
      setProtegiendoIdx(i);
      try {
        const res = await fetch('/api/postgres/proteccion-historial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numeroId: caso.numeroId,
            titularId: ctx.titularId,
            contratoViejo: caso.contratoViejo,
            contratoNuevo: ctx.contratoNuevo,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data?.error || `Error ${res.status}`);
      } catch (e: any) {
        setProtegiendoIdx(null);
        // Reencola desde el que falló (los ya protegidos no reaparecen).
        setProteccionCasos(casos.slice(i));
        setProteccionError(`No se pudo archivar el historial de ${caso.nombre}: ${e?.message || e}`);
        return;
      }
    }
    setProtegiendoIdx(null);
    setProteccionCasos([]);
    irAlContrato(ctx.titularId);
  };

  return (
    <DashboardLayout>
      <PermissionGuard permission={ComercialPermission.MODIFICAR_CONTRATO}>
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Crear Contrato</h1>
            <p className="mt-2 text-gray-600">Complete el formulario para crear un nuevo contrato</p>
          </div>
          {/* Checkbox de contrato de prueba — naranja, prominente */}
          <label
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-colors select-none ${
              esContratoPrueba
                ? 'bg-orange-100 border-orange-500 text-orange-800 shadow-sm'
                : 'bg-white border-orange-300 text-orange-700 hover:bg-orange-50'
            }`}
            title="Los contratos de prueba reciben prefijo PRB- y se descartan automáticamente de los informes. Pueden borrarse en Mantenimiento > Usuarios > Contratos Prueba."
          >
            <input
              type="checkbox"
              checked={esContratoPrueba}
              onChange={e => setEsContratoPrueba(e.target.checked)}
              className="h-4 w-4 rounded border-orange-400 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm font-semibold">🧪 Contrato de prueba</span>
          </label>
        </div>

        {/* Banner persistente cuando está marcado, para que el comercial no lo olvide */}
        {esContratoPrueba && (
          <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 rounded-lg p-3 text-sm text-orange-800">
            <strong>Modo prueba activo.</strong> Este contrato se creará con número <code className="px-1 py-0.5 bg-orange-100 rounded text-orange-900">PRB-NNNNN-YY</code> (el número se asigna al crear), NO aparecerá en informes y podrá ser purgado en <em>Mantenimiento › Usuarios › Contratos Prueba</em>. Desmarca el checkbox si es real.
          </div>
        )}

        {/* Draft restore banner */}
        {showDraftBanner && (
          <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-amber-800">Tienes un contrato en progreso</p>
              <p className="text-sm text-amber-600">
                {(() => {
                  const d = (window as any).__contractDraft
                  const name = d?.titular ? `${d.titular.primerNombre || ''} ${d.titular.primerApellido || ''}`.trim() : ''
                  const ago = d?.savedAt ? Math.round((Date.now() - d.savedAt) / 3600000) : 0
                  return name
                    ? `Para ${name} — guardado hace ${ago < 1 ? 'menos de 1 hora' : `${ago}h`}`
                    : `Guardado hace ${ago < 1 ? 'menos de 1 hora' : `${ago}h`}`
                })()}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={discardDraft}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Descartar
              </button>
              <button
                onClick={restoreDraft}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => {
              const skip4 = esEmpresa && step === 4;
              return (
              <div
                key={step}
                className={`flex-1 ${step === 7 ? '' : 'border-b-2'} ${
                  !skip4 && step <= currentStep ? 'border-primary-600' : 'border-gray-200'
                } pb-4`}
              >
                <div
                  className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center ${
                    skip4
                      ? 'bg-gray-100 text-gray-400 line-through'
                      : step <= currentStep
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                <p className={`text-xs text-center mt-2 ${skip4 ? 'line-through text-gray-400' : ''}`}>
                  {step === 1 && 'Asesor'}
                  {step === 2 && 'Datos básicos'}
                  {step === 3 && 'Ubicación'}
                  {step === 4 && (skip4 ? 'Adicional (omitido)' : 'Adicional')}
                  {step === 5 && 'Referencias'}
                  {step === 6 && 'Financiero'}
                  {step === 7 && 'Beneficiarios'}
                </p>
              </div>
              );
            })}
          </div>
        </div>

        {/* Encabezado persistente: titular + número de contrato, visible en todos los pasos */}
        {(nombreTitular || contrato) && (
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-primary-50 border border-primary-100 px-4 py-3">
            <div className="text-sm text-gray-600">
              Titular: <span className="font-bold text-gray-900">{nombreTitular || '—'}</span>
            </div>
            <div className="text-sm text-gray-600">
              Contrato: <span className="font-bold text-gray-900">{contrato || 'se asigna al crear'}</span>
            </div>
            {titular.plataforma && (
              <div className="text-sm text-gray-600">
                Plataforma: <span className="font-bold text-gray-900">{titular.plataforma}</span>
              </div>
            )}
            {esEmpresa && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">EMPRESA</span>
            )}
          </div>
        )}

        {/* Form steps */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* Step 1: Asesor */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Instrucciones del proceso: las 4 opciones que definen cómo queda
                  el contrato y que NO todas se pueden corregir después de crearlo. */}
              <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">
                <h3 className="text-base font-bold text-amber-900 flex items-center gap-2">
                  ⚠️ Antes de empezar — verifique estas 4 opciones
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  Definen cómo queda el contrato y <strong>no todas se pueden corregir después</strong>. Revíselas en el paso indicado:
                </p>
                <ol className="mt-3 space-y-2.5 text-sm text-amber-900">
                  <li>
                    <span className="font-bold">1. 🧪 Contrato de prueba</span>
                    <span className="text-amber-700"> — arriba a la derecha, en esta misma pantalla.</span>
                    <br />
                    Márquelo <strong>solo si está realizando algún tipo de prueba o con fines de aprendizaje</strong>. Aunque el proceso es completo, no genera datos en producción. Si el contrato es real, déjelo <strong>sin marcar</strong>.
                  </li>
                  <li>
                    <span className="font-bold">2. Tipo de contrato: Persona Natural o Empresa</span>
                    <span className="text-amber-700"> — paso 2, botón arriba a la derecha.</span>
                    <br />
                    Cambia los campos que se capturan y el texto del contrato. <strong>Empresa</strong> pide razón social, NIT/RUT, rubro y los datos del <em>representante de la empresa</em>; <strong>Persona Natural</strong> captura los datos personales del titular.
                  </li>
                  <li>
                    <span className="font-bold">3. ¿Este titular será beneficiario?</span>
                    <span className="text-amber-700"> — paso 2.</span>
                    <br />
                    Márquelo si el titular <strong>también tomará el programa</strong>. Si no lo marca, queda solo como responsable financiero y no se le crea ficha académica. No aplica cuando el titular es Empresa.
                  </li>
                  <li>
                    <span className="font-bold">4. SENCE (Servicio Nacional de Capacitación y Empleo)</span>
                    <span className="text-amber-700"> — paso 2.</span>
                    <br />
                    <strong>SENCE</strong> es el organismo del Estado de Chile que financia la capacitación de los trabajadores mediante la <em>franquicia tributaria</em>. Active el botón <strong>solo si el contrato es para un usuario que se inscribió o se inscribirá en SENCE</strong>. Está disponible únicamente para titular <strong>Empresa</strong> de <strong>Chile</strong>; al activarlo se pide una confirmación y luego se habilita el <em>código SENCE por beneficiario</em> en el paso de Beneficiarios.
                  </li>
                </ol>
              </div>
              <h2 className="text-xl font-semibold mb-4">Información del Asesor</h2>
              {/* NOMBRE → PEOPLE.asesorCreadorContrato · EMAIL → PEOPLE.asesor.
                  Van separados a propósito: `asesor` (email) es la llave con la
                  que se resuelve el nombre del comercial contra USUARIOS_ROLES
                  (getAsesorInfo) para el contrato y la pestaña Financiera. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asesor creador del contrato *
                </label>
                <input
                  type="text"
                  value={titular.asesorCreadorContrato}
                  onChange={(e) => setTitular({...titular, asesorCreadorContrato: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Nombre del asesor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email del asesor comercial *
                </label>
                <input
                  type="email"
                  value={titular.asesor}
                  onChange={(e) => setTitular({...titular, asesor: e.target.value.replace(/\s/g, '')})}
                  className={
                    `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 ` +
                    (titular.asesor !== '' && !isValidEmail(titular.asesor) ? 'border-red-400' : 'border-gray-300')
                  }
                  placeholder="correo@dominio.com"
                />
                {titular.asesor !== '' && !isValidEmail(titular.asesor) ? (
                  <p className="text-xs text-red-600 mt-1">El correo no es válido (debe llevar @ y dominio, sin espacios).</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Se usa para identificar al comercial en el contrato y en la ficha del titular.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Datos básicos */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <h2 className="text-xl font-semibold">Datos Básicos del Titular</h2>
                {/* Switch Persona Natural / Empresa (estilo Kids) */}
                <div className="inline-flex rounded-full border border-gray-300 bg-gray-100 p-1" role="group" aria-label="Tipo de persona">
                  <button
                    type="button"
                    onClick={() => { if (esEmpresa) elegirTitularBenef(null); setTitular({...titular, tipoPersona: 'Persona Natural'}); setSenceUsuario(false); }}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${!esEmpresa ? 'bg-primary-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Persona Natural
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTitular({...titular, tipoPersona: 'Empresa'}); elegirTitularBenef('NO'); }}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${esEmpresa ? 'bg-purple-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Empresa
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={esEmpresa ? 'col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {esEmpresa ? 'Nombre de la empresa *' : 'Primer nombre *'}
                  </label>
                  <input
                    type="text"
                    value={titular.primerNombre}
                    onChange={(e) => setTitular({...titular, primerNombre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder={esEmpresa ? 'Razón social' : ''}
                  />
                </div>
                {!esEmpresa && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Segundo nombre
                  </label>
                  <input
                    type="text"
                    value={titular.segundoNombre}
                    onChange={(e) => setTitular({...titular, segundoNombre: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                )}
                {!esEmpresa && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primer apellido *
                  </label>
                  <input
                    type="text"
                    value={titular.primerApellido}
                    onChange={(e) => setTitular({...titular, primerApellido: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                )}
                {!esEmpresa && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Segundo apellido
                  </label>
                  <input
                    type="text"
                    value={titular.segundoApellido}
                    onChange={(e) => setTitular({...titular, segundoApellido: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {esEmpresa ? 'Identificación fiscal (RUT) *' : 'Número de identificación *'}
                  </label>
                  <input
                    type="text"
                    value={titular.numeroId}
                    onKeyDown={(e) => {
                      if (!/^[a-zA-Z0-9]$/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)) {
                        e.preventDefault()
                      }
                    }}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase()
                      setTitular({...titular, numeroId: clean})
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Solo letras mayúsculas y números"
                  />
                </div>
                {/* Rubro — solo modo Empresa. En el contrato va entre NIT/RUT y Domicilio. */}
                {esEmpresa && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="rubro-empresa">
                      Rubro
                    </label>
                    <input
                      id="rubro-empresa"
                      type="text"
                      maxLength={150}
                      value={titular.rubro || ''}
                      onChange={(e) => setTitular({...titular, rubro: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Giro o actividad económica"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plataforma *
                  </label>
                  <select
                    value={titular.plataforma}
                    onChange={(e) => {
                      setTitular({...titular, plataforma: e.target.value})
                      if (e.target.value !== 'Chile') setSenceUsuario(false) // SENCE es solo Chile
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Chile">Chile</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Ecuador">Ecuador</option>
                    <option value="Perú">Perú</option>
                  </select>
                </div>
                {/* ¿El titular será beneficiario? SÍ / NO — obligatorio (fila completa, antes del número de contrato).
                    SÍ = la antigua casilla marcada. En Empresa no aplica (queda en NO). */}
                <div className="col-span-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-lg font-bold ${esEmpresa ? 'text-gray-400' : 'text-gray-900'}`}>
                      ¿Este titular será beneficiario SÍ / NO? (tomará el programa) {!esEmpresa && <span className="text-red-600">*</span>}
                    </span>
                    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="radiogroup" aria-label="¿El titular será beneficiario?">
                      {(['SI', 'NO'] as const).map(op => {
                        const activo = !esEmpresa && titularBenefRespuesta === op
                        return (
                          <button
                            key={op}
                            type="button"
                            role="radio"
                            aria-checked={activo}
                            disabled={esEmpresa}
                            onClick={() => elegirTitularBenef(op)}
                            className={`px-5 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              activo
                                ? (op === 'SI' ? 'bg-green-600 text-white' : 'bg-gray-700 text-white')
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                            } ${op === 'NO' ? 'border-l border-gray-300' : ''}`}
                          >
                            {op === 'SI' ? 'SÍ' : 'NO'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <p className={`mt-1 text-xs ${esEmpresa ? 'text-gray-400' : titularBenefRespuesta === null ? 'text-red-600' : 'text-gray-500'}`}>
                    {esEmpresa
                      ? 'No aplica: una empresa no toma el programa.'
                      : titularBenefRespuesta === null
                        ? 'Campo obligatorio: debe marcar SÍ o NO.'
                        : titularBenefRespuesta === 'SI'
                          ? 'El titular también tomará clases de inglés (se crea como beneficiario).'
                          : 'El titular solo será responsable del contrato (no tomará el programa).'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de contrato
                  </label>
                  <div className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md bg-gray-50 text-sm text-gray-500 italic">
                    Se asignará al crear el contrato (después de la verificación)
                  </div>
                </div>
                {/* Representante legal — solo modo Empresa (el Tipo de Persona ahora es el switch del encabezado) */}
                {esEmpresa && (
                  <div className="col-span-2 border-t border-gray-200 pt-4 mt-1">
                    <p className="text-sm font-bold text-purple-700 mb-3">Representante de la empresa</p>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                        <input
                          type="text"
                          value={titular.replegal || ''}
                          onChange={(e) => setTitular({...titular, replegal: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="replegal-cargo">Cargo *</label>
                        <input
                          id="replegal-cargo"
                          type="text"
                          maxLength={120}
                          value={titular.replegalcargo || ''}
                          onChange={(e) => setTitular({...titular, replegalcargo: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Ej: Gerente General"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Identificación *</label>
                        <input
                          type="text"
                          value={titular.replegalid || ''}
                          onChange={(e) => setTitular({...titular, replegalid: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Celular *</label>
                        <input
                          type="tel"
                          value={titular.replegalcel || ''}
                          onChange={(e) => setTitular({...titular, replegalcel: e.target.value.replace(/\D/g, '')})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    {(() => {
                      const senceHabilitado = titular.tipoPersona === 'Empresa' && titular.plataforma === 'Chile'
                      const senceHint = senceHabilitado
                        ? 'Actívelo SOLO si el usuario se inscribió o se inscribirá en SENCE. El código SENCE se captura por beneficiario.'
                        : titular.tipoPersona !== 'Empresa'
                          ? 'Disponible solo si el titular es Empresa'
                          : 'SENCE solo aplica a contratos de Chile'
                      return (
                    <div className="relative group flex items-center">
                      {/* Botón (switch) SENCE. Al ENCENDER pide confirmación explícita
                          — ver modal showSenceConfirm; al apagar no pregunta. */}
                      <button
                        type="button"
                        id="senceUsuario"
                        role="switch"
                        aria-checked={senceUsuario}
                        disabled={!senceHabilitado}
                        onClick={() => { if (senceUsuario) { setSenceUsuario(false) } else { setShowSenceConfirm(true) } }}
                        className={'inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 text-base font-bold transition-colors ' + (
                          !senceHabilitado
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : senceUsuario
                              ? 'bg-sky-600 border-sky-700 text-white shadow'
                              : 'bg-white border-sky-300 text-sky-700 hover:bg-sky-50'
                        )}
                      >
                        <span className={'inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ' + (senceUsuario ? 'bg-white/40' : 'bg-gray-200')}>
                          <span className={'h-4 w-4 rounded-full bg-white shadow transform transition-transform ' + (senceUsuario ? 'translate-x-4' : 'translate-x-0.5')} />
                        </span>
                        SENCE (Servicio Nacional de Capacitación y Empleo)
                      </button>
                      <span className="invisible group-hover:visible absolute left-0 top-full mt-1 bg-gray-800 text-white text-sm rounded px-3 py-1.5 max-w-md z-10">
                        {senceHint}
                      </span>
                    </div>
                      )
                    })()}
                  </div>
                  {senceUsuario && (
                    <div className="mt-3 rounded-lg border-l-4 border-sky-500 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                      <strong>Contrato SENCE activo.</strong> Este contrato se está creando para un usuario que se inscribió o se inscribirá en <strong>SENCE (Servicio Nacional de Capacitación y Empleo)</strong>. En el paso de <em>Beneficiarios</em> podrá marcar cuáles van por SENCE y cargar su código. Si no corresponde, desactive el botón.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Ubicación */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Ubicación</h2>
              <div className="grid grid-cols-2 gap-4">
                {esEmpresa ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Correo electrónico *
                    </label>
                    <input
                      type="email"
                      value={titular.email}
                      onChange={(e) => setTitular({...titular, email: e.target.value.replace(/\s/g, '')})}
                      placeholder="correo@empresa.com"
                      className={
                        `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 ` +
                        (titular.email !== '' && !isValidEmail(titular.email) ? 'border-red-400' : 'border-gray-300')
                      }
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de nacimiento *
                    </label>
                    <input
                      type="date"
                      value={titular.fechaNacimiento}
                      onChange={(e) => setTitular({...titular, fechaNacimiento: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    País *
                  </label>
                  {esEmpresa ? (
                    <input
                      type="text"
                      value={titular.plataforma || '—'}
                      readOnly
                      title="El país se toma de la plataforma"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                    />
                  ) : (
                    <select
                      value={titular.pais}
                      onChange={(e) => setTitular({...titular, pais: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      {COUNTRY_PREFIXES.map((country) => (
                        <option key={country.country} value={country.country}>
                          {country.country}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domicilio *
                  </label>
                  <input
                    type="text"
                    value={titular.domicilio}
                    onChange={(e) => setTitular({...titular, domicilio: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad *
                  </label>
                  <input
                    type="text"
                    value={titular.ciudad}
                    onChange={(e) => setTitular({...titular, ciudad: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Celular * ({getPhonePrefix()})
                  </label>
                  <input
                    type="tel"
                    value={titular.celular}
                    onChange={(e) => setTitular({...titular, celular: e.target.value.replace(/\D/g, '')})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Número sin prefijo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono fijo
                  </label>
                  <input
                    type="tel"
                    value={titular.telefono}
                    onChange={(e) => setTitular({...titular, telefono: e.target.value.replace(/\D/g, '')})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Información adicional (omitido en modo Empresa) */}
          {currentStep === 4 && !esEmpresa && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Información Adicional</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ingresos *
                  </label>
                  <input
                    type="text"
                    value={titular.ingresos ? formatNumber(titular.ingresos) : ''}
                    onChange={(e) => setTitular({...titular, ingresos: e.target.value.replace(/\D/g, '')})}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={titular.email}
                    onChange={(e) => setTitular({...titular, email: e.target.value.replace(/\s/g, '')})}
                    placeholder="correo@dominio.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={titular.empresa}
                    onChange={(e) => setTitular({...titular, empresa: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={titular.cargo}
                    onChange={(e) => setTitular({...titular, cargo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Género *
                  </label>
                  <select
                    value={titular.genero}
                    onChange={(e) => setTitular({...titular, genero: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Seleccione</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Referencias */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Referencias</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Referencia 1 *</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        value={titular.referenciaUno}
                        onChange={(e) => setTitular({...titular, referenciaUno: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parentesco *
                      </label>
                      <input
                        type="text"
                        value={titular.parentezcoRefUno}
                        onChange={(e) => setTitular({...titular, parentezcoRefUno: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono *
                      </label>
                      <input
                        type="tel"
                        value={titular.telRefUno}
                        onChange={(e) => setTitular({...titular, telRefUno: e.target.value.replace(/\D/g, '')})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Referencia 2 *</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        value={titular.referenciaDos}
                        onChange={(e) => setTitular({...titular, referenciaDos: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parentesco *
                      </label>
                      <input
                        type="text"
                        value={titular.parentezcoRefDos}
                        onChange={(e) => setTitular({...titular, parentezcoRefDos: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono *
                      </label>
                      <input
                        type="tel"
                        value={titular.telRefDos}
                        onChange={(e) => setTitular({...titular, telRefDos: e.target.value.replace(/\D/g, '')})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Información financiera */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Información Financiera</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total del plan *
                  </label>
                  <input
                    type="text"
                    value={formatNumber(financial.totalPlan)}
                    onChange={(e) => {
                      const numericValue = Number(e.target.value.replace(/\D/g, ''));
                      handleNumericChange('totalPlan', e.target.value, setFinancial);
                      calculateBalance(numericValue, financial.pagoInscripcion);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pago inscripción *
                  </label>
                  <input
                    type="text"
                    value={formatNumber(financial.pagoInscripcion)}
                    onChange={(e) => {
                      const numericValue = Number(e.target.value.replace(/\D/g, ''));
                      handleNumericChange('pagoInscripcion', e.target.value, setFinancial);
                      calculateBalance(financial.totalPlan, numericValue);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saldo
                  </label>
                  <input
                    type="text"
                    value={formatNumber(financial.saldo)}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de cuotas / Tipo Plan
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={financial.numeroCuotas}
                      onChange={(e) => {
                        const numCuotas = Number(e.target.value);
                        setFinancial({...financial, numeroCuotas: numCuotas});
                        calculateInstallmentValue(financial.saldo, numCuotas);
                      }}
                      min="0"
                      max="99"
                      placeholder="Cuotas"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                    <select
                      aria-label="Tipo Plan"
                      title="Tipo Plan"
                      value={financial.tipoPlan}
                      onChange={(e) => setFinancial({...financial, tipoPlan: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Tipo plan</option>
                      <option value="Contado">Contado</option>
                      <option value="Credito">Credito</option>
                      <option value="Colaborador">Colaborador</option>
                      <option value="Empresa">Empresa</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor cuota
                  </label>
                  <input
                    type="text"
                    value={formatNumber(financial.valorCuota)}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de pago *
                  </label>
                  <input
                    type="date"
                    value={financial.fechaPago}
                    onChange={(e) => setFinancial({...financial, fechaPago: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vigencia * <span className="text-xs text-gray-400">(meses, 1–12)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={financial.vigencia}
                    onKeyDown={(e) => {
                      // Block anything that is not a digit, backspace, delete, arrows or tab
                      if (!/^\d$/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)) {
                        e.preventDefault()
                      }
                    }}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      if (raw === '') { setFinancial({...financial, vigencia: ''}); return }
                      const num = parseInt(raw, 10)
                      if (!isNaN(num) && num >= 1 && num <= 12) {
                        setFinancial({...financial, vigencia: String(num)})
                      }
                    }}
                    onBlur={(e) => {
                      const num = parseInt(e.target.value, 10)
                      if (isNaN(num) || num < 1) setFinancial({...financial, vigencia: '1'})
                      else if (num > 12)         setFinancial({...financial, vigencia: '12'})
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="1 – 12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medio de pago *
                  </label>
                  <select
                    value={financial.medioPago}
                    onChange={(e) => setFinancial({...financial, medioPago: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Seleccione</option>
                    {getPaymentOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Beneficiarios */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold">Beneficiarios</h2>
                <button
                  type="button"
                  onClick={addBeneficiario}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Agregar Beneficiario
                </button>
              </div>
              <p className="text-sm text-gray-500">
                {esEmpresa
                  ? 'Llena la lista de beneficiarios (una fila por persona). Usa "Agregar Beneficiario" para sumar filas.'
                  : 'Agrega cada beneficiario en su tarjeta. Usa "Agregar Beneficiario" para sumar más.'}
              </p>

              {(() => {
                const senceCol = titular.plataforma === 'Chile' && esEmpresa && senceUsuario
                // El titular-beneficiario se agrega automáticamente al crear (backend);
                // aquí se muestra como fila informativa para que sea visible.
                const mostrarTitular = titularEsBeneficiario && !esEmpresa
                if (beneficiarios.length === 0 && !mostrarTitular) {
                  return (
                    <p className="text-gray-500 text-center py-8">
                      No hay beneficiarios agregados. Agrega el primero con &quot;Agregar Beneficiario&quot; o continúa sin ellos.
                    </p>
                  )
                }
                // Persona Natural → tarjetas (Kids por modal). Empresa → tabla.
                if (!esEmpresa) {
                  return (
                    <div className="space-y-4">
                      {mostrarTitular && (
                        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">TITULAR</span>
                            <h3 className="font-medium text-gray-900">{[titular.primerNombre, titular.primerApellido].filter(Boolean).join(' ') || '—'}</h3>
                            <span className="text-xs text-gray-500">(toma el programa — se controla con la casilla del paso 2)</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                            <div>Documento: <span className="font-medium text-gray-800">{titular.numeroId || '—'}</span></div>
                            <div>Fecha nac.: <span className="font-medium text-gray-800">{titular.fechaNacimiento || '—'}</span></div>
                            <div>Email: <span className="font-medium text-gray-800">{titular.email || '—'}</span></div>
                            <div>Celular: <span className="font-medium text-gray-800">{titular.celular || '—'}</span></div>
                          </div>
                        </div>
                      )}
                      {beneficiarios.map((beneficiario, index) => (
                        <div key={index} className={`border rounded-lg p-4 ${beneficiario.kids ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'}`}>
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="font-medium text-gray-900">Beneficiario {index + 1}</h3>
                              {kidsFeatureEnabled && (
                                <div className="flex items-center gap-2">
                                  <button type="button" role="switch" aria-checked={beneficiario.kids === true} aria-label="Kids"
                                    onClick={() => {
                                      const encender = !beneficiario.kids
                                      const upd = [...beneficiarios]
                                      if (encender) { upd[index] = { ...upd[index], kids: true }; setBeneficiarios(upd); setKidsModalIndex(index) }
                                      else { upd[index] = { ...upd[index], kids: false, kidsData: undefined }; setBeneficiarios(upd) }
                                    }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${beneficiario.kids ? 'bg-primary-600' : 'bg-gray-300'}`}>
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${beneficiario.kids ? 'translate-x-5' : 'translate-x-1'}`} />
                                  </button>
                                  <span className="text-xs font-semibold text-purple-700">🧒 Kids</span>
                                  {beneficiario.kids && (
                                    <button type="button" onClick={() => setKidsModalIndex(index)} className="text-xs text-blue-700 underline">editar datos</button>
                                  )}
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => removeBeneficiario(index)} className="text-red-500 hover:text-red-700">
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Primer nombre *</label>
                              <input value={beneficiario.primerNombre}
                                onChange={(e) => updateBeneficiario(index, 'primerNombre', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Segundo nombre</label>
                              <input value={beneficiario.segundoNombre || ''}
                                onChange={(e) => updateBeneficiario(index, 'segundoNombre', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Primer apellido *</label>
                              <input value={beneficiario.primerApellido}
                                onChange={(e) => updateBeneficiario(index, 'primerApellido', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Segundo apellido</label>
                              <input value={beneficiario.segundoApellido || ''}
                                onChange={(e) => updateBeneficiario(index, 'segundoApellido', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Número ID *</label>
                              <input value={beneficiario.numeroId}
                                onKeyDown={(e) => { if (!/^[a-zA-Z0-9]$/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)) e.preventDefault() }}
                                onChange={(e) => updateBeneficiario(index, 'numeroId', e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase())}
                                placeholder="Solo letras mayúsculas y números"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                              <input type="date" value={beneficiario.fechaNacimiento || ''}
                                onChange={(e) => updateBeneficiario(index, 'fechaNacimiento', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                              <input type="email" value={beneficiario.email || ''}
                                onChange={(e) => updateBeneficiario(index, 'email', e.target.value.replace(/\s/g, ''))}
                                placeholder="correo@dominio.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Celular * ({getPhonePrefix()})</label>
                              <input type="tel" value={beneficiario.celular || ''}
                                onChange={(e) => updateBeneficiario(index, 'celular', e.target.value.replace(/\D/g, ''))}
                                placeholder="Número sin prefijo"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
                return (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-2 py-2 text-left">#</th>
                          {kidsFeatureEnabled && <th className="px-2 py-2 text-left">Kids</th>}
                          <th className="px-2 py-2 text-left">Primer nombre *</th>
                          <th className="px-2 py-2 text-left">Segundo nombre</th>
                          <th className="px-2 py-2 text-left">Primer apellido *</th>
                          <th className="px-2 py-2 text-left">Segundo apellido</th>
                          <th className="px-2 py-2 text-left">N° ID *</th>
                          <th className="px-2 py-2 text-left">Fecha nac.</th>
                          <th className="px-2 py-2 text-left">Email *</th>
                          <th className="px-2 py-2 text-left">Celular * ({getPhonePrefix()})</th>
                          {senceCol && <th className="px-2 py-2 text-left">SENCE</th>}
                          {senceCol && <th className="px-2 py-2 text-left">Cód. SENCE</th>}
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {mostrarTitular && (
                          <tr className="border-t border-gray-100 bg-amber-50">
                            <td className="px-2 py-1 align-middle">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 whitespace-nowrap">TITULAR</span>
                            </td>
                            {kidsFeatureEnabled && <td className="px-2 py-1 text-center text-gray-400">—</td>}
                            <td className="px-2 py-1 text-gray-700">{titular.primerNombre || '—'}</td>
                            <td className="px-2 py-1 text-gray-700">{titular.segundoNombre || ''}</td>
                            <td className="px-2 py-1 text-gray-700">{titular.primerApellido || '—'}</td>
                            <td className="px-2 py-1 text-gray-700">{titular.segundoApellido || ''}</td>
                            <td className="px-2 py-1 text-gray-700 font-mono">{titular.numeroId || '—'}</td>
                            <td className="px-2 py-1 text-gray-700">{titular.fechaNacimiento || '—'}</td>
                            <td className="px-2 py-1 text-gray-700">{titular.email || '—'}</td>
                            <td className="px-2 py-1 text-gray-700">{titular.celular || '—'}</td>
                            {senceCol && <td className="px-2 py-1 text-center text-gray-400">—</td>}
                            {senceCol && <td className="px-2 py-1 text-center text-gray-400">—</td>}
                            <td className="px-2 py-1 text-center">
                              <span className="text-[10px] text-gray-400" title="El titular toma el programa; se controla con la casilla del paso 2">auto</span>
                            </td>
                          </tr>
                        )}
                        {beneficiarios.map((beneficiario, index) => (
                          <tr key={index} className={`border-t border-gray-100 ${beneficiario.kids ? 'bg-blue-50/60' : ''}`}>
                            <td className="px-2 py-1 text-gray-400 font-medium align-middle">{index + 1}</td>
                            {kidsFeatureEnabled && (
                              <td className="px-2 py-1 whitespace-nowrap align-middle">
                                <div className="flex items-center gap-2">
                                  <button type="button" role="switch" aria-checked={beneficiario.kids === true} aria-label="Kids"
                                    onClick={() => {
                                      const encender = !beneficiario.kids
                                      const upd = [...beneficiarios]
                                      if (encender) { upd[index] = { ...upd[index], kids: true }; setBeneficiarios(upd); setKidsModalIndex(index) }
                                      else { upd[index] = { ...upd[index], kids: false, kidsData: undefined }; setBeneficiarios(upd) }
                                    }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${beneficiario.kids ? 'bg-primary-600' : 'bg-gray-300'}`}>
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${beneficiario.kids ? 'translate-x-5' : 'translate-x-1'}`} />
                                  </button>
                                  {beneficiario.kids && (
                                    <button type="button" onClick={() => setKidsModalIndex(index)} className="text-xs text-blue-700 underline">editar</button>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="px-1 py-1">
                              <input value={beneficiario.primerNombre}
                                onChange={(e) => updateBeneficiario(index, 'primerNombre', e.target.value)}
                                className="w-full min-w-[120px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={beneficiario.segundoNombre || ''}
                                onChange={(e) => updateBeneficiario(index, 'segundoNombre', e.target.value)}
                                className="w-full min-w-[110px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={beneficiario.primerApellido}
                                onChange={(e) => updateBeneficiario(index, 'primerApellido', e.target.value)}
                                className="w-full min-w-[120px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={beneficiario.segundoApellido || ''}
                                onChange={(e) => updateBeneficiario(index, 'segundoApellido', e.target.value)}
                                className="w-full min-w-[110px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={beneficiario.numeroId}
                                onKeyDown={(e) => { if (!/^[a-zA-Z0-9]$/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)) e.preventDefault() }}
                                onChange={(e) => updateBeneficiario(index, 'numeroId', e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase())}
                                placeholder="MAYÚS/números"
                                className="w-full min-w-[110px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            </td>
                            <td className="px-1 py-1">
                              <input type="date" value={beneficiario.fechaNacimiento || ''}
                                onChange={(e) => updateBeneficiario(index, 'fechaNacimiento', e.target.value)}
                                className="w-full min-w-[140px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            </td>
                            <td className="px-1 py-1">
                              <input type="email" value={beneficiario.email || ''}
                                onChange={(e) => updateBeneficiario(index, 'email', e.target.value.replace(/\s/g, ''))}
                                placeholder="correo@dominio.com"
                                className="w-full min-w-[170px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            </td>
                            <td className="px-1 py-1">
                              <input type="tel" value={beneficiario.celular || ''}
                                onChange={(e) => updateBeneficiario(index, 'celular', e.target.value.replace(/\D/g, ''))}
                                placeholder="sin prefijo"
                                className="w-full min-w-[120px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400" />
                            </td>
                            {senceCol && (
                              <td className="px-2 py-1 text-center align-middle">
                                <input type="checkbox" checked={beneficiario.sence === true}
                                  onChange={(e) => { const upd = [...beneficiarios]; upd[index] = { ...upd[index], sence: e.target.checked, senceCode: e.target.checked ? upd[index].senceCode : '' }; setBeneficiarios(upd) }}
                                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                              </td>
                            )}
                            {senceCol && (
                              <td className="px-1 py-1">
                                <input value={beneficiario.senceCode || ''} disabled={beneficiario.sence !== true}
                                  onChange={(e) => { const upd = [...beneficiarios]; upd[index] = { ...upd[index], senceCode: e.target.value.replace(/[^A-Za-z0-9-]/g, '') }; setBeneficiarios(upd) }}
                                  placeholder="código"
                                  className="w-full min-w-[100px] px-2 py-1 border border-gray-200 rounded font-mono disabled:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-400" />
                              </td>
                            )}
                            <td className="px-2 py-1 align-middle">
                              <button type="button" onClick={() => removeBeneficiario(index)} className="text-red-500 hover:text-red-700">
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md">
              {success}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-6 flex justify-between">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Anterior
              </button>
            )}

            {currentStep < 7 ? (
              <button
                type="button"
                onClick={handleNext}
                className={`ml-auto inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 ${
                  currentStep === 1 ? 'w-full justify-center' : ''
                }`}
              >
                Siguiente
                <ArrowRightIcon className="h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="ml-auto inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creando...' : 'Crear Contrato'}
              </button>
            )}
          </div>
        </div>
        </div>

        {/* Overlay mientras se verifica (paso 2 o al crear) */}
        {verifLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="bg-white rounded-xl shadow-xl px-6 py-4 text-sm text-gray-700 flex items-center gap-3">
              <span className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              Verificando documento(s) en otros contratos…
            </div>
          </div>
        )}

        {/* Modal: VERIFICACIÓN (titular en el paso 2 · beneficiarios al crear) */}
        {verif && (() => {
          const rol = rolDeItem(verif.kind)
          const clasif = verif.items.map(it => clasificar(it.registros, rol))
          const hayBloqueo = clasif.some(c => c.bloqueos.length > 0)
          const hayPendiente = clasif.some(c => c.porResolver.length > 0)
          const puedeContinuar = !verif.error && !hayBloqueo && !hayPendiente
          const sinHallazgos = !verif.error && clasif.every(c => !c.bloqueos.length && !c.porResolver.length && !c.info.length)
          const esTitular = verif.kind === 'titular'
          const siBenef = titularEsBeneficiario && !esEmpresa
          const continuar = () => {
            const v = verif
            setVerif(null)
            setTraerDatosMsg('')
            if (v.kind === 'titular') advanceStep()
            else abrirConfirmacionCreacion((v.lista || []) as Beneficiario[])
          }
          const firmaTxt = (r: RegDoc) => SITUACION_TXT[r.situacion]
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {esTitular ? '🔎 Verificación del titular' : '🔎 Verificación de beneficiarios'}
                </h3>

                {esTitular && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                    <div>
                      <strong>{nombreCompletoTitular() || '—'}</strong> · documento <strong>{titular.numeroId}</strong>
                    </div>
                    {esEmpresa ? (
                      <div className="mt-1">Titular <strong>Empresa</strong> (no toma el programa).</div>
                    ) : (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span>¿Será beneficiario?</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-white ${siBenef ? 'bg-green-600' : 'bg-gray-700'}`}>{siBenef ? 'SÍ' : 'NO'}</span>
                        <span className="text-gray-500">{siBenef ? 'tomará clases y se crea también como beneficiario' : 'solo será responsable del contrato'}</span>
                        <button type="button" onClick={() => elegirTitularBenef(siBenef ? 'NO' : 'SI')}
                          className="ml-auto text-xs underline text-blue-700">Cambiar a {siBenef ? 'NO' : 'SÍ'}</button>
                      </div>
                    )}
                  </div>
                )}

                {verif.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    No se pudo completar la verificación: {verif.error}.
                    <button type="button" onClick={() => (esTitular ? abrirVerificacionTitular() : continuarConfirmacion((verif.lista || []) as Beneficiario[]))}
                      className="ml-2 underline">Reintentar</button>
                  </div>
                )}

                {sinHallazgos && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    ✓ Sin coincidencias en otros contratos activos.
                  </div>
                )}

                {verif.items.map((it, idx) => {
                  const c = clasif[idx]
                  if (!c.bloqueos.length && !c.porResolver.length && !c.info.length) return null
                  return (
                    <div key={it.numeroId} className="space-y-2">
                      {!esTitular && <div className="text-sm font-semibold text-gray-800">{it.quien} · {it.numeroId}</div>}

                      {c.bloqueos.map(r => (
                        <div key={r.personId} className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                          <div className="font-bold">⛔ Una persona no puede ser beneficiaria en dos contratos</div>
                          <div className="mt-1">Ya es <strong>beneficiaria</strong> del contrato <strong>{r.contrato}</strong> ({firmaTxt(r)}).</div>
                          <div className="mt-2 text-xs">
                            {esTitular
                              ? <>Debe <strong>desmarcarlo</strong>: cambie la respuesta a <strong>NO</strong> o cancele.</>
                              : <>Quite o corrija este beneficiario en el paso <strong>Beneficiarios</strong> antes de crear el contrato.</>}
                          </div>
                          {esTitular && (
                            <button type="button" onClick={() => elegirTitularBenef('NO')}
                              className="mt-2 px-3 py-1.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700">Cambiar a NO</button>
                          )}
                        </div>
                      ))}

                      {c.porResolver.map(r => {
                        const esContratoTitular = r.tipoUsuario === 'TITULAR'
                        const bloqueadoPorPagos = esContratoTitular && r.pagosValidados > 0
                        return (
                          <div key={r.personId} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            <div className="font-bold">
                              ⚠️ {esContratoTitular
                                ? `Existe un contrato previo sin gestionar (${firmaTxt(r)})`
                                : 'Una persona no puede ser beneficiaria en dos contratos'}
                            </div>
                            <div className="mt-1">
                              {esContratoTitular
                                ? <>Este documento es <strong>titular</strong> del contrato <strong>{r.contrato}</strong> ({firmaTxt(r)}).</>
                                : <>Ya es <strong>beneficiaria</strong> del contrato <strong>{r.contrato}</strong> ({firmaTxt(r)}).</>}
                              {' '}Debe definir uno de los dos: continuar gestionando el contrato anterior, o anularlo y continuar con este.
                            </div>
                            {bloqueadoPorPagos && (
                              <div className="mt-1 text-xs text-red-700">
                                El contrato {r.contrato} tiene <strong>{r.pagosValidados} pago(s) validado(s)</strong>: no se puede anular desde aquí; gestiónelo desde su ficha.
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" onClick={() => irAlContratoAnterior(r)} disabled={!r.titularId}
                                className="px-3 py-1.5 text-xs font-semibold rounded border border-amber-400 bg-white text-amber-900 hover:bg-amber-100 disabled:opacity-50">
                                Continuar con el contrato {r.contrato}
                              </button>
                              <button type="button" onClick={() => anularAnterior(idx, r)} disabled={bloqueadoPorPagos || anulandoId === r.personId}
                                className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                {anulandoId === r.personId ? 'Anulando…' : esContratoTitular ? `Anular el contrato ${r.contrato} y continuar` : `Anular su registro en ${r.contrato} y continuar`}
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {c.info.map(r => (
                        <div key={r.personId} className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                          <div>
                            ℹ️ {r.tipoUsuario === 'TITULAR'
                              ? <>Ya es <strong>titular</strong> de otro contrato: <strong>{r.contrato}</strong> ({firmaTxt(r)}). Puede continuar.</>
                              : <>Es <strong>beneficiaria</strong> del contrato <strong>{r.contrato}</strong> ({firmaTxt(r)}). Como aquí solo será titular, puede continuar.</>}
                          </div>
                          {esTitular && r.tipoUsuario === 'TITULAR' && verif.datosPrevios && (
                            <button type="button" onClick={traerDatosPrevios}
                              className="mt-2 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700">
                              Traer sus datos
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* Antecedentes del titular — solo informativos, no bloquean */}
                {esTitular && ((verif.previos?.length ?? 0) > 0 || verif.academica) && (
                  <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-800 space-y-1.5">
                    <div className="font-semibold text-gray-700">ℹ️ Antecedentes (informativo, no impide continuar)</div>
                    {(verif.previos || []).map(p => (
                      <div key={`${p.contrato}-${p.tipoUsuario}`}>
                        Tuvo el contrato <strong>{p.contrato}</strong> ({p.estado}) como {p.tipoUsuario.toLowerCase()}.
                        {p.pagosValidados > 0 && (
                          <span className="text-red-700"> Tiene <strong>{p.pagosValidados} pago(s) validado(s)</strong>: el contrato nuevo <strong>no</strong> los hereda — coordine con Recaudos su aplicación o devolución.</span>
                        )}
                      </div>
                    ))}
                    {verif.academica && (
                      <div>
                        Ya tomó clases: ficha académica en <strong>{[verif.academica.nivel, verif.academica.step].filter(Boolean).join(' · ') || '—'}</strong>
                        {verif.academica.clases > 0 && <> ({verif.academica.clases} clase(s) registradas)</>}.
                        {' '}Si será beneficiario, al crear el contrato su historial se archivará y la ficha quedará limpia.
                      </div>
                    )}
                  </div>
                )}

                {traerDatosMsg && <div className="text-xs text-blue-700">{traerDatosMsg}</div>}

                {!puedeContinuar && !verif.error && (
                  <p className="text-xs text-gray-500">Resuelva los avisos en rojo o ámbar para poder continuar.</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => { setVerif(null); setTraerDatosMsg('') }}
                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="button" onClick={continuar} disabled={!puedeContinuar}
                    className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {esTitular ? 'Confirmar y seguir' : 'Continuar a crear el contrato'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Modal: confirmar que el contrato es para un usuario SENCE (guard del botón) */}
        {showSenceConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Confirmar contrato SENCE</h3>
              <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-3 text-sm text-sky-900">
                Este contrato <strong>se realizará para un usuario que se inscribió o se inscribirá en SENCE</strong> (Servicio Nacional de Capacitación y Empleo).
                <br /><br />
                Si es así, continúe. De lo contrario, <strong>desactive el botón</strong>.
              </div>
              <p className="text-xs text-gray-500">
                SENCE es el organismo del Estado de Chile que financia la capacitación de trabajadores mediante la franquicia tributaria. Al activarlo, en el paso de Beneficiarios podrá marcar cuáles van por SENCE y cargar su código.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setSenceUsuario(true); setShowSenceConfirm(false); }}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
                >
                  Sí, es un contrato SENCE — continuar
                </button>
                <button
                  type="button"
                  onClick={() => { setSenceUsuario(false); setShowSenceConfirm(false); }}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  No — dejar el botón desactivado
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Kids: reúne todos los datos del beneficiario (regulares + curso + apoderado) */}
        <KidsBeneficiarioModal
          open={kidsModalIndex !== null}
          initial={kidsModalIndex !== null ? beneficiarios[kidsModalIndex] : undefined}
          titularNombre={`${titular.primerNombre || ''} ${titular.segundoNombre || ''}`.trim()}
          titularApellidos={`${titular.primerApellido || ''} ${titular.segundoApellido || ''}`.trim()}
          titularDocumento={titular.numeroId}
          titularCelular={titular.celular ? getPhonePrefix() + titular.celular : ''}
          titularEmail={titular.email}
          plataforma={titular.plataforma}
          ocultarGuia
          onSave={saveKidsModal}
          onCancel={cancelKidsModal}
        />

        {/* Modal: protección de historial (beneficiarios con ficha académica previa) */}
        {proteccionCasos.length > 0 && proteccionCtx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl">📚</div>
                <h3 className="text-lg font-bold text-gray-900">Ya tomaron el programa antes</h3>
              </div>
              <p className="text-sm text-gray-600">
                {proteccionCasos.length === 1 ? 'La siguiente persona' : 'Las siguientes personas'} de este
                contrato ya {proteccionCasos.length === 1 ? 'tomó' : 'tomaron'} el programa antes.
                Se archiva su historial académico como documento del titular y se limpia la ficha:
              </p>
              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
                {proteccionCasos.map((c, i) => (
                  <li key={c.numeroId} className="flex items-center justify-between px-3 py-2">
                    <span>
                      <span className="font-medium text-gray-900">{c.nombre || c.numeroId}</span>
                      <span className="text-gray-400"> · ID {c.numeroId}</span>
                      {c.contratoViejo && <span className="text-gray-400"> · contrato {c.contratoViejo}</span>}
                      <span className="text-gray-500"> · {c.bookings} agendamiento(s)</span>
                    </span>
                    {protegiendoIdx === i && (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></span>
                    )}
                  </li>
                ))}
              </ul>
              {proteccionError ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800 text-sm">
                  ⚠️ {proteccionError}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>
                  Generando informe(s) (PDF), adjuntando a la documentación del titular y limpiando la(s) ficha(s)…
                </div>
              )}
              {proteccionError && proteccionCtx && (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setProteccionCasos([]); irAlContrato(); }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Continuar sin proteger
                  </button>
                  <button
                    type="button"
                    onClick={() => protegerTodos(proteccionCasos, proteccionCtx)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: confirmar creación sin beneficiarios (nadie tomará clases) */}
        {showNoBenefConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">⚠️ Sin beneficiarios</h3>
              <p className="text-sm text-gray-700">
                Este contrato <strong>no tiene beneficiarios</strong> y el titular <strong>no es
                beneficiario</strong>, así que <strong>nadie quedará inscrito en el programa</strong>.
                ¿Deseas crear el contrato de todas formas?
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNoBenefConfirm(false)}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Volver y agregar beneficiario
                </button>
                <button
                  type="button"
                  onClick={doSubmit}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Crear de todas formas
                </button>
                <button
                  type="button"
                  onClick={() => setShowNoBenefConfirm(false)}
                  className="w-full px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de creación: muestra estado del titular + lista de beneficiarios */}
        {showCreateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Confirmar creación del contrato</h3>

              {/* Chips de las opciones estructurales del contrato */}
              <div className="flex flex-wrap gap-2">
                <span className={'px-2.5 py-1 rounded-full text-xs font-bold ' + (esEmpresa ? 'bg-purple-100 text-purple-800' : 'bg-primary-100 text-primary-800')}>
                  {esEmpresa ? 'Empresa' : 'Persona Natural'}
                </span>
                <span className={'px-2.5 py-1 rounded-full text-xs font-bold ' + (esContratoPrueba ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700')}>
                  {esContratoPrueba ? '🧪 Contrato de PRUEBA' : 'Contrato real'}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                  {titular.plataforma || 'Sin plataforma'}
                </span>
              </div>

              {/* SENCE — se enfatiza porque define cómo se financia el contrato */}
              {senceUsuario ? (
                <div className="rounded-lg bg-sky-50 border-2 border-sky-400 px-3 py-3 text-sm text-sky-900">
                  <p className="font-bold text-sky-900">CONTRATO SENCE</p>
                  <p className="mt-1">
                    Este contrato queda marcado como <strong>SENCE (Servicio Nacional de Capacitación y Empleo)</strong>: se realizará para un usuario que <strong>se inscribió o se inscribirá en SENCE</strong>.
                  </p>
                  <p className="mt-1 font-semibold">
                    Verifique que sea correcto. Si no lo es, cancele y desactive el botón SENCE en el paso 2.
                  </p>
                </div>
              ) : (esEmpresa && titular.plataforma === 'Chile') ? (
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
                  Este contrato <strong>NO</strong> está marcado como SENCE. Si el usuario se inscribió o se inscribirá en SENCE, cancele y active el botón en el paso 2.
                </div>
              ) : null}

              {/* Estado del titular como beneficiario — en la parte superior */}
              {titularEsBeneficiario ? (
                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm font-semibold text-green-800">
                  ✅ El titular SERÁ beneficiario (también tomará clases).
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
                  El titular NO está marcado como beneficiario (no tomará clases).
                </div>
              )}

              {/* Lista de beneficiarios */}
              {beneficiarios.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Beneficiarios a inscribir ({beneficiarios.length}):
                  </p>
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                    {beneficiarios.map((b, idx) => (
                      <li key={idx} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {`${b.primerNombre || ''} ${b.primerApellido || ''}`.trim() || '—'}
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">ID {b.numeroId || '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  No hay beneficiarios adicionales; solo el titular quedará inscrito.
                </p>
              )}

              {/* Advertencia (no bloquea): beneficiario(s) con el mismo celular del titular */}
              {(() => {
                const dup = benefsMismoCelularTitular(beneficiarios)
                return dup.length > 0 ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    ⚠️ {dup.length === 1 ? 'Un beneficiario tiene' : `${dup.length} beneficiarios tienen`} el mismo celular que el titular ({titular.celular}). Verifica que sea correcto — puedes continuar.
                  </div>
                ) : null
              })()}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreateConfirm(false); doSubmit(); }}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Confirmar y crear contrato
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateConfirm(false)}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Aviso: beneficiario(s) en blanco al intentar crear */}
        {showBlankBenefWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">⚠️ Beneficiario sin información</h3>
              <p className="text-sm text-gray-700">
                Hay <strong>{beneficiarios.filter(isBeneficiarioBlank).length} beneficiario(s) sin datos</strong>.
                ¿Desea llenar sus datos o borrarlo(s)?
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBlankBenefWarning(false)}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Llenar datos
                </button>
                <button
                  type="button"
                  onClick={descartarBlancosYContinuar}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Borrar y continuar
                </button>
              </div>
            </div>
          </div>
        )}
      </PermissionGuard>
    </DashboardLayout>
  );
}