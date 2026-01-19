import { NextRequest, NextResponse } from 'next/server';

// Contract country codes mapping
const CONTRACT_COUNTRY_CODES: Record<string, string> = {
  "Chile": "01",
  "Colombia": "02",
  "Ecuador": "03",
  "Perú": "04"
};

// Generate contract number format: XX-NNNNN-YY
async function generateContractNumber(country: string): Promise<string> {
  const countryCode = CONTRACT_COUNTRY_CODES[country];
  if (!countryCode) {
    throw new Error(`Invalid country for contract generation: ${country}`);
  }

  const currentYear = new Date().getFullYear().toString().slice(-2); // Last 2 digits of year
  const nextSequential = await getNextSequentialNumber(countryCode, currentYear);

  return `${countryCode}-${nextSequential}-${currentYear}`;
}

// Get next sequential number for a country
async function getNextSequentialNumber(countryCode: string, year: string): Promise<string> {
  try {
    // Fetch existing contracts to find the highest number
    const apiBaseUrl = process.env.NEXTAUTH_URL || '';
    const response = await fetch(`${apiBaseUrl}/api/wix-proxy/contracts-by-pattern`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pattern: `${countryCode}-`,
        year: year
      })
    });

    if (!response.ok) {
      console.error('Error fetching contracts:', await response.text());
      return '10000'; // Default starting number
    }

    const data = await response.json();
    let maxNumber = 9999; // Initial number (next will be 10000)

    if (data.contracts && data.contracts.length > 0) {
      // Find the maximum sequential number
      data.contracts.forEach((contract: any) => {
        if (contract.contrato) {
          const parts = contract.contrato.split('-');
          if (parts.length === 3) {
            const currentNumber = parseInt(parts[1], 10);
            if (!isNaN(currentNumber) && currentNumber > maxNumber) {
              maxNumber = currentNumber;
            }
          }
        }
      });
    }

    const nextNumber = maxNumber + 1;
    return nextNumber.toString().padStart(5, '0');
  } catch (error) {
    console.error('Error getting sequential number:', error);
    return '10000'; // Default starting number
  }
}

// Calculate age from birth date
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

// Normalize and format monetary values
function formatMonetaryValue(value: number): string {
  return value.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

// Clean text (remove extra spaces)
function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

// Capitalize first letter
function capitalizeFirstLetter(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { titular, financial, beneficiarios = [], titularEsBeneficiario = false } = body;

    // Validate required fields for titular
    if (!titular || !titular.primerNombre || !titular.primerApellido || !titular.numeroId) {
      return NextResponse.json({
        error: 'Datos del titular incompletos'
      }, { status: 400 });
    }

    // Generate contract number
    const contractNumber = await generateContractNumber(titular.pais);

    // Calculate age
    const birthDate = new Date(titular.fechaNacimiento);
    const age = calculateAge(birthDate);

    // Prepare titular data for PEOPLE collection
    const titularData = {
      primerNombre: capitalizeFirstLetter(titular.primerNombre),
      segundoNombre: capitalizeFirstLetter(titular.segundoNombre || ''),
      primerApellido: capitalizeFirstLetter(titular.primerApellido),
      segundoApellido: capitalizeFirstLetter(titular.segundoApellido || ''),
      numeroId: cleanText(titular.numeroId),
      fechaNacimiento: birthDate.toISOString().split('T')[0],
      edad: age.toString(),
      plataforma: titular.pais,
      domicilio: titular.domicilio || '',
      ciudad: titular.ciudad || '',
      celular: cleanText(titular.celular || ''),
      ingresos: titular.ingresos || '',
      email: titular.email || '',
      empresa: titular.empresa || '',
      cargo: capitalizeFirstLetter(titular.cargo || ''),
      genero: titular.genero || '',
      tipoUsuario: 'TITULAR',
      telefono: titular.telefono || '',
      referenciaUno: capitalizeFirstLetter(titular.referenciaUno || ''),
      parentezcoRefUno: titular.parentezcoRefUno || '',
      telefonoRefUno: titular.telRefUno || '',
      referenciaDos: capitalizeFirstLetter(titular.referenciaDos || ''),
      telefonoRefDos: titular.telRefDos || '',
      parentezcoRefDos: titular.parentezcoRefDos || '',
      vigencia: financial?.vigencia || '',
      contrato: contractNumber,
      asesorCreadorContrato: titular.asesorCreadorContrato || '',
      _createdDate: new Date().toISOString()
    };

    // Create titular in PEOPLE collection
    const apiBaseUrl = process.env.NEXTAUTH_URL || '';
    const createTitularResponse = await fetch(`${apiBaseUrl}/api/wix-proxy/create-person`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(titularData)
    });

    if (!createTitularResponse.ok) {
      const errorText = await createTitularResponse.text();
      throw new Error(`Error creating titular: ${errorText}`);
    }

    const createdTitular = await createTitularResponse.json();
    const titularId = createdTitular._id;

    // Create financial record if provided
    if (financial) {
      const financialData = {
        primerNombre: titularData.primerNombre,
        primerApellido: titularData.primerApellido,
        numeroId: titularData.numeroId,
        totalPlan: formatMonetaryValue(financial.totalPlan || 0),
        valorCuota: financial.numeroCuotas === 0 ? "0" : formatMonetaryValue(financial.valorCuota || 0),
        pagoInscripcion: formatMonetaryValue(financial.pagoInscripcion || 0),
        saldo: formatMonetaryValue(financial.saldo || 0),
        numeroCuotas: financial.numeroCuotas || 0,
        fechaPago: financial.fechaPago || '',
        titularId: titularId,
        vigencia: financial.vigencia || '',
        medioPago: financial.medioPago || '',
        contrato: contractNumber,
        _createdDate: new Date().toISOString()
      };

      const createFinancialResponse = await fetch(`${apiBaseUrl}/api/wix-proxy/create-financial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(financialData)
      });

      if (!createFinancialResponse.ok) {
        console.error('Error creating financial record:', await createFinancialResponse.text());
      }
    }

    // Create beneficiario for titular if checkbox is checked
    const createdBeneficiarios = [];
    if (titularEsBeneficiario) {
      const titularBeneficiarioData = {
        primerNombre: titularData.primerNombre,
        segundoNombre: titularData.segundoNombre,
        primerApellido: titularData.primerApellido,
        segundoApellido: titularData.segundoApellido,
        numeroId: titularData.numeroId,
        fechaNacimiento: titularData.fechaNacimiento,
        edad: titularData.edad,
        email: titularData.email,
        celular: titularData.celular,
        tipoUsuario: 'BENEFICIARIO',
        titularId: titularId,
        contrato: contractNumber,
        plataforma: titularData.plataforma,
        _createdDate: new Date().toISOString()
      };

      const createTitularBeneficiarioResponse = await fetch(`${apiBaseUrl}/api/wix-proxy/create-person`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(titularBeneficiarioData)
      });

      if (createTitularBeneficiarioResponse.ok) {
        const created = await createTitularBeneficiarioResponse.json();
        createdBeneficiarios.push(created);
      } else {
        console.error('Error creating titular as beneficiario:', await createTitularBeneficiarioResponse.text());
      }
    }

    // Create beneficiarios if provided
    for (const beneficiario of beneficiarios) {
      const beneficiarioBirthDate = new Date(beneficiario.fechaNacimiento);
      const beneficiarioAge = calculateAge(beneficiarioBirthDate);

      const beneficiarioData = {
        ...beneficiario,
        primerNombre: capitalizeFirstLetter(beneficiario.primerNombre),
        segundoNombre: capitalizeFirstLetter(beneficiario.segundoNombre || ''),
        primerApellido: capitalizeFirstLetter(beneficiario.primerApellido),
        segundoApellido: capitalizeFirstLetter(beneficiario.segundoApellido || ''),
        numeroId: cleanText(beneficiario.numeroId),
        fechaNacimiento: beneficiarioBirthDate.toISOString().split('T')[0],
        edad: beneficiarioAge.toString(),
        tipoUsuario: 'BENEFICIARIO',
        titularId: titularId,
        contrato: contractNumber,
        _createdDate: new Date().toISOString()
      };

      const createBeneficiarioResponse = await fetch(`${apiBaseUrl}/api/wix-proxy/create-person`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(beneficiarioData)
      });

      if (createBeneficiarioResponse.ok) {
        const created = await createBeneficiarioResponse.json();
        createdBeneficiarios.push(created);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        titular: createdTitular,
        contractNumber: contractNumber,
        beneficiarios: createdBeneficiarios
      }
    });

  } catch (error) {
    console.error('Error creating contract:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creating contract' },
      { status: 500 }
    );
  }
}