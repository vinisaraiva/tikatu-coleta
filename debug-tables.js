const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://okduzgpkahddkdpzibua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDc3MDksImV4cCI6MjA2NTAyMzcwOX0.-CIuPMipeet_jpTjj6kAdn3YRqBWrvrSCxDtV82kIRw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugTables() {
  try {
    console.log('=== VERIFICANDO TABELAS E DADOS ===\n');

    // 1. Verificar tabela volunteers
    console.log('1. TABELA VOLUNTEERS:');
    const { data: volunteers, error: volError } = await supabase
      .from('volunteers')
      .select('*');

    if (volError) {
      console.error('Erro ao buscar volunteers:', volError);
    } else {
      console.log(`Encontrados ${volunteers.length} voluntários:`);
      volunteers.forEach(vol => {
        console.log(`  - ID: ${vol.id}, Código: ${vol.code}, Nome: ${vol.nome}, Point ID: ${vol.point_id}, Ativo: ${vol.is_active}`);
      });
    }

    console.log('\n2. TABELA POINTS:');
    const { data: points, error: pointsError } = await supabase
      .from('points')
      .select('*');

    if (pointsError) {
      console.error('Erro ao buscar points:', pointsError);
    } else {
      console.log(`Encontrados ${points.length} pontos:`);
      points.forEach(point => {
        console.log(`  - ID: ${point.id}, Nome: ${point.name}, River ID: ${point.river_id}, Ativo: ${point.is_active}`);
      });
    }

    console.log('\n3. TABELA RIVERS:');
    const { data: rivers, error: riversError } = await supabase
      .from('rivers')
      .select('*');

    if (riversError) {
      console.error('Erro ao buscar rivers:', riversError);
    } else {
      console.log(`Encontrados ${rivers.length} rios:`);
      rivers.forEach(river => {
        console.log(`  - ID: ${river.id}, Nome: ${river.name}, City ID: ${river.city_id}`);
      });
    }

    console.log('\n4. TABELA CITIES:');
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('*');

    if (citiesError) {
      console.error('Erro ao buscar cities:', citiesError);
    } else {
      console.log(`Encontradas ${cities.length} cidades:`);
      cities.forEach(city => {
        console.log(`  - ID: ${city.id}, Nome: ${city.name}`);
      });
    }

    console.log('\n5. VERIFICANDO VOLUNTÁRIO VOL368731:');
    const { data: volunteer, error: volSpecificError } = await supabase
      .from('volunteers')
      .select('*')
      .eq('code', 'VOL368731')
      .maybeSingle();

    if (volSpecificError) {
      console.error('Erro ao buscar VOL368731:', volSpecificError);
    } else if (volunteer) {
      console.log('Voluntário VOL368731 encontrado:');
      console.log(`  - ID: ${volunteer.id}`);
      console.log(`  - Código: ${volunteer.code}`);
      console.log(`  - Nome: ${volunteer.nome}`);
      console.log(`  - Point ID: ${volunteer.point_id}`);
      console.log(`  - Ativo: ${volunteer.is_active}`);

      // Verificar se o ponto existe
      if (volunteer.point_id) {
        const { data: point, error: pointCheckError } = await supabase
          .from('points')
          .select('*')
          .eq('id', volunteer.point_id)
          .maybeSingle();

        if (pointCheckError) {
          console.error('Erro ao verificar ponto:', pointCheckError);
        } else if (point) {
          console.log(`  - Ponto encontrado: ID ${point.id}, Nome: ${point.name}`);
        } else {
          console.log(`  - ⚠️ PONTO NÃO ENCONTRADO (ID: ${volunteer.point_id})`);
        }
      }
    } else {
      console.log('Voluntário VOL368731 NÃO ENCONTRADO');
    }

    console.log('\n6. TABELA READINGS (estrutura):');
    const { data: readings, error: readingsError } = await supabase
      .from('readings')
      .select('*')
      .limit(1);

    if (readingsError) {
      console.error('Erro ao verificar readings:', readingsError);
    } else {
      console.log('Estrutura da tabela readings verificada');
    }

  } catch (error) {
    console.error('Erro geral:', error);
  }
}

debugTables(); 