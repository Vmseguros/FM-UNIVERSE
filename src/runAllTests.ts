if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    length: 0,
  } as Storage;
}

import { runFM26ImporterTests } from './services/fm26Importer.test';
import { runComprehensiveFM26ParserTests } from './services/fm26ParserComprehensive.test';

async function main() {
  console.log('====================================================');
  console.log('  EXECUÇÃO DE TESTES FM UNIVERSE - PADRÃO CSV FM26  ');
  console.log('====================================================');

  try {
    console.log('\n--- 1. Executando Bateria de Homologação e Proteção ---');
    const res = await runFM26ImporterTests();
    if (!res.passed) {
      console.error('Falhas encontradas na bateria existente:');
      res.details.forEach((d) => console.log(d));
      process.exit(1);
    }
    console.log('✅ Bateria existente de 15 testes passou com sucesso!');

    console.log('\n--- 2. Executando Bateria Abrangente do Parser CSV FM26 ---');
    runComprehensiveFM26ParserTests();

    console.log('\n====================================================');
    console.log('  TODOS OS TESTES FORAM EXECUTADOS COM SUCESSO (OK) ');
    console.log('====================================================');
  } catch (err) {
    console.error('ERRO NA EXECUÇÃO DOS TESTES:', err);
    process.exit(1);
  }
}

main();
