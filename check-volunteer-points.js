const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://okduzgpkahddkdpzibua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDc3MDksImV4cCI6MjA2NTAyMzcwOX0.-CIuPMipeet_jpTjj6kAdn3YRqBWrvrSCxDtV82kIRw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkVolunteerPoints() {
  try {
    console.log('=== VERIFICANDO ESTRUTURA DE VOLUNTÁRIOS E PONTOS ===\n');

    // 1. Verificar estrutura da tabela volunteers
    console.log('1. ESTRUTURA DA TABELA VOLUNTEERS:');
    const { data: volunteers, error: volError } = await supabase
      .from('volunteers')
      .select('*')
      .limit(3);

    if (volError) {
      console.error('Erro ao buscar volunteers:', volError);
    } else if (volunteers && volunteers.length > 0) {
      console.log('Campos encontrados:', Object.keys(volunteers[0]));
      console.log('Exemplo de registro:', JSON.stringify(volunteers[0], null, 2));
    }

    // 2. Verificar se existe tabela volunteer_points
    console.log('\n2. VERIFICANDO TABELA volunteer_points:');
    const { data: volunteerPoints, error: vpError } = await supabase
      .from('volunteer_points')
      .select('*')
      .limit(5);

    if (vpError) {
      console.log('Tabela volunteer_points não encontrada ou erro:', vpError.message);
    } else {
      console.log('Tabela volunteer_points encontrada!');
      console.log('Registros:', volunteerPoints);
    }

    // 3. Verificar se existe tabela volunteer_collection_points
    console.log('\n3. VERIFICANDO TABELA volunteer_collection_points:');
    const { data: volunteerCollectionPoints, error: vcpError } = await supabase
      .from('volunteer_collection_points')
      .select('*')
      .limit(5);

    if (vcpError) {
      console.log('Tabela volunteer_collection_points não encontrada ou erro:', vcpError.message);
    } else {
      console.log('Tabela volunteer_collection_points encontrada!');
      console.log('Registros:', volunteerCollectionPoints);
    }

    // 4. Verificar um voluntário específico e seus pontos
    console.log('\n4. VERIFICANDO PONTOS DE UM VOLUNTÁRIO:');
    const { data: testVolunteer, error: testError } = await supabase
      .from('volunteers')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!testError && testVolunteer) {
      console.log('Voluntário de teste:', testVolunteer.code, '- Point ID:', testVolunteer.point_id);
      
      // Tentar buscar pontos relacionados via tabela intermediária
      if (volunteerPoints && volunteerPoints.length > 0) {
        const { data: relatedPoints, error: rpError } = await supabase
          .from('volunteer_points')
          .select(`
            *,
            point:points(*)
          `)
          .eq('volunteer_id', testVolunteer.id);

        if (!rpError && relatedPoints) {
          console.log('Pontos relacionados encontrados:', relatedPoints.length);
          relatedPoints.forEach(vp => {
            console.log(`  - Point ID: ${vp.point_id}, Point: ${vp.point?.name || 'N/A'}`);
          });
        }
      }
    }

    // 5. Listar todas as tabelas disponíveis (se possível)
    console.log('\n5. VERIFICANDO TABELAS DISPONÍVEIS:');
    const tables = ['volunteers', 'points', 'volunteer_points', 'volunteer_collection_points', 'readings'];
    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (!error) {
        console.log(`  ✓ Tabela ${table} existe`);
      } else {
        console.log(`  ✗ Tabela ${table} não existe ou não acessível`);
      }
    }

  } catch (error) {
    console.error('Erro geral:', error);
  }
}

checkVolunteerPoints();

