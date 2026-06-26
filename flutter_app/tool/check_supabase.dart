import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  await Supabase.initialize(
    url: 'https://veyrcvvvsomyrahjfvhh.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXJjdnZ2c29teXJhaGpmdmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjI5MzUsImV4cCI6MjA5NzMzODkzNX0.-N470V130EwnrJabX1CMId8hLiaQal0g_al_eMJzQ-Q',
  );
  
  final client = Supabase.instance.client;
  try {
    final buckets = await client.storage.listBuckets();
    print('Buckets:');
    for (var b in buckets) {
      print('- ${b.name}');
    }
  } catch (e) {
    print('Error listing buckets: $e');
  }
}
