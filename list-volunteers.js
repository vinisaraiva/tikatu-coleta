const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://okduzgpkahddkdpzibua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDc3MDksImV4cCI6MjA2NTAyMzcwOX0.-CIuPMipeet_jpTjj6kAdn3YRqBWrvrSCxDtV82kIRw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listVolunteers() {
  try {
    console.log('Listando todos os voluntários...');
    
    // Listar todos os voluntários
    const { data: volunteers, error: volunteersError } = await supabase
      .from('volunteers')
      .select(`
        id,
        code,
        nome,
        point_id,
        is_active,
        point:points(
          id,
          name,
          river:rivers(
            id,
            name,
            city:cities(
              id,
              name
            )
          )
        )
      `);

    if (volunteersError) {
      console.error('Erro ao buscar voluntários:', volunteersError);
      return;
    }

    if (!volunteers || volunteers.length === 0) {
      console.log('Nenhum voluntário encontrado no banco');
      return;
    }

    console.log(`\nEncontrados ${volunteers.length} voluntários:`);
    console.log('=====================================');
    
    volunteers.forEach((volunteer, index) => {
      console.log(`\n${index + 1}. Voluntário:`);
      console.log(`   ID: ${volunteer.id}`);
      console.log(`   Código: ${volunteer.code}`);
      console.log(`   Nome: ${volunteer.nome}`);
      console.log(`   Point ID: ${volunteer.point_id}`);
      console.log(`   Ativo: ${volunteer.is_active}`);
      
      if (volunteer.point) {
        console.log(`   Ponto: ${volunteer.point.name}`);
        console.log(`   Rio: ${volunteer.point.river?.name}`);
        console.log(`   Cidade: ${volunteer.point.river?.city?.name}`);
      } else {
        console.log(`   ⚠️  Ponto não encontrado (ID: ${volunteer.point_id})`);
      }
    });

    // Verificar pontos existentes
    console.log('\n\nVerificando pontos existentes...');
    const { data: points, error: pointsError } = await supabase
      .from('points')
      .select('id, name, river_id');

    if (pointsError) {
      console.error('Erro ao buscar pontos:', pointsError);
    } else {
      console.log(`\nEncontrados ${points.length} pontos:`);
      points.forEach(point => {
        console.log(`   Point ID: ${point.id} - Nome: ${point.name} - River ID: ${point.river_id}`);
      });
    }

  } catch (error) {
    console.error('Erro geral:', error);
  }
}

listVolunteers(); 