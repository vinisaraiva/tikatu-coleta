const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://okduzgpkahddkdpzibua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDc3MDksImV4cCI6MjA2NTAyMzcwOX0.-CIuPMipeet_jpTjj6kAdn3YRqBWrvrSCxDtV82kIRw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkVolunteer() {
  try {
    console.log('Verificando voluntário VOL368731...');
    
    // Primeiro, listar todos os voluntários para ver a estrutura
    const { data: allVolunteers, error: listError } = await supabase
      .from('volunteers')
      .select('*');

    if (listError) {
      console.error('Erro ao listar voluntários:', listError);
      return;
    }

    console.log('Todos os voluntários encontrados:');
    allVolunteers.forEach(vol => {
      console.log(`- ID: ${vol.id}, Código: ${vol.code}, Nome: ${vol.nome}, Point ID: ${vol.point_id}`);
    });

    // Agora buscar especificamente o VOL368731
    const { data: volunteer, error: volunteerError } = await supabase
      .from('volunteers')
      .select('*')
      .eq('code', 'VOL368731')
      .maybeSingle();

    if (volunteerError) {
      console.error('Erro ao buscar voluntário específico:', volunteerError);
      return;
    }

    if (!volunteer) {
      console.log('Voluntário VOL368731 não encontrado');
      return;
    }

    console.log('\nVoluntário VOL368731 encontrado:');
    console.log('ID:', volunteer.id);
    console.log('Código:', volunteer.code);
    console.log('Nome:', volunteer.nome);
    console.log('Point ID:', volunteer.point_id);
    console.log('Ativo:', volunteer.is_active);

    // Verificar se o ponto existe
    if (volunteer.point_id) {
      const { data: point, error: pointError } = await supabase
        .from('points')
        .select('*')
        .eq('id', volunteer.point_id)
        .maybeSingle();

      if (pointError) {
        console.error('Erro ao verificar ponto:', pointError);
      } else if (point) {
        console.log('\nPonto encontrado:');
        console.log('Point ID:', point.id);
        console.log('Nome:', point.name);
        console.log('River ID:', point.river_id);
      } else {
        console.log('\n⚠️ Ponto não encontrado (ID:', volunteer.point_id, ')');
      }
    }

  } catch (error) {
    console.error('Erro geral:', error);
  }
}

checkVolunteer(); 