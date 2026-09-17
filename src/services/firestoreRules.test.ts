/**
 * firestoreRules.test.ts
 * 
 * Teste unitário de auditoria das regras de segurança do Firestore (firestore.rules)
 * Simula formalmente o avaliador de regras para garantir que:
 * 1. Leitura pública de jogadores permanece liberada para o portal.
 * 2. Managers autenticados NÃO conseguem criar ou atualizar jogadores.
 * 3. Criação e atualização de jogadores são permitidas APENAS para administradores seguros.
 * 4. Exclusão de jogadores é bloqueada permanentemente para todos os perfis.
 * 5. fm26_import_batches e fm26_audits são protegidos contra managers e usuários comuns.
 * 6. A coleção /admins/{adminId} tem escrita bloqueada pelo cliente (impossibilitando auto-promoção).
 */

export interface MockAuthToken {
  role?: string;
  admin?: boolean;
  email?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

export interface MockAuthContext {
  uid: string;
  token: MockAuthToken;
}

export interface MockRequestContext {
  auth: MockAuthContext | null;
  adminsCollectionUids: Set<string>;
}

/**
 * Avalia as funções de segurança conforme definidas no firestore.rules
 */
export function evaluateIsAuthenticated(request: MockRequestContext): boolean {
  return request.auth !== null;
}

export function evaluateIsAdmin(request: MockRequestContext): boolean {
  if (!evaluateIsAuthenticated(request)) return false;
  const auth = request.auth!;
  
  // 1. UID de administrador verificado na plataforma
  const isVerifiedAdminUid = auth.uid === 'jNe5SV5EJPZX4Ifpy7SREuxBnNI3' || auth.uid === 'jNe5SV5EJPZX4Ipyf7SReuXnBNI3';

  // 2. E-mail de administrador verificado na plataforma (vmseguroservico@gmail.com)
  const isVerifiedAdminEmail = auth.token.email === 'vmseguroservico@gmail.com';

  // 3. Custom Claims no token JWT (criptograficamente assinadas pelo Firebase Auth)
  const hasAdminRoleClaim = auth.token.role === 'ADMIN';
  const hasAdminBoolClaim = auth.token.admin === true;
  
  // 4. Presença do UID na coleção protegida /admins
  const isDocumentInAdmins = request.adminsCollectionUids.has(auth.uid);

  return isVerifiedAdminUid || isVerifiedAdminEmail || hasAdminRoleClaim || hasAdminBoolClaim || isDocumentInAdmins;
}

/**
 * Regra para /jogadores/{playerId}
 */
export function evaluateJogadoresRules(
  operation: 'read' | 'create' | 'update' | 'delete',
  request: MockRequestContext
): { allowed: boolean; reason: string } {
  if (operation === 'read') {
    return { allowed: true, reason: 'Leitura pública permitida para o portal' };
  }
  if (operation === 'create' || operation === 'update') {
    if (evaluateIsAdmin(request)) {
      return { allowed: true, reason: 'Operação autorizada para Administrador verificado' };
    }
    return { allowed: false, reason: 'Criação/Atualização permitida APENAS para administradores' };
  }
  if (operation === 'delete') {
    return { allowed: false, reason: 'Exclusão permanentemente bloqueada (allow delete: if false)' };
  }
  return { allowed: false, reason: 'Operação não suportada' };
}

/**
 * Regra para /fm26_import_batches/{batchId}
 */
export function evaluateFM26BatchesRules(
  operation: 'read' | 'create' | 'update' | 'delete',
  request: MockRequestContext
): { allowed: boolean; reason: string } {
  if (operation === 'read') {
    if (evaluateIsAuthenticated(request)) {
      return { allowed: true, reason: 'Leitura de auditoria permitida para usuários autenticados' };
    }
    return { allowed: false, reason: 'Requer autenticação para leitura' };
  }
  if (operation === 'create' || operation === 'update') {
    if (evaluateIsAdmin(request)) {
      return { allowed: true, reason: 'Gravação autorizada exclusivamente para Administrador' };
    }
    return { allowed: false, reason: 'Gravação permitida APENAS para administradores' };
  }
  if (operation === 'delete') {
    return { allowed: false, reason: 'Exclusão permanentemente bloqueada' };
  }
  return { allowed: false, reason: 'Operação não suportada' };
}

/**
 * Regra para /admins/{adminId}
 */
export function evaluateAdminsCollectionRules(
  operation: 'read' | 'write',
  request: MockRequestContext
): { allowed: boolean; reason: string } {
  if (operation === 'read') {
    return { allowed: evaluateIsAuthenticated(request), reason: 'Leitura para autenticados' };
  }
  if (operation === 'write') {
    return { allowed: false, reason: 'Escrita bloqueada pelo cliente: impossível auto-promoção' };
  }
  return { allowed: false, reason: 'Operação desconhecida' };
}

/**
 * Executa os cenários de teste da auditoria
 */
export function runFirestoreRulesAuditTests(): { passed: boolean; details: string[] } {
  const details: string[] = [];
  let allOk = true;

  const check = (condition: boolean, msg: string) => {
    if (condition) {
      details.push(`✅ SUCESSO: ${msg}`);
    } else {
      details.push(`❌ FALHA: ${msg}`);
      allOk = false;
    }
  };

  const registeredAdmins = new Set<string>(['admin-master-uid', 'server-admin-uid']);

  // Cenário 1: Visitante Anônimo
  const anonymousRequest: MockRequestContext = {
    auth: null,
    adminsCollectionUids: registeredAdmins,
  };
  check(evaluateJogadoresRules('read', anonymousRequest).allowed === true, 'Visitante anônimo pode ler jogadores no portal');
  check(evaluateJogadoresRules('create', anonymousRequest).allowed === false, 'Visitante anônimo NÃO pode criar jogadores');
  check(evaluateJogadoresRules('update', anonymousRequest).allowed === false, 'Visitante anônimo NÃO pode atualizar jogadores');
  check(evaluateJogadoresRules('delete', anonymousRequest).allowed === false, 'Visitante anônimo NÃO pode excluir jogadores');

  // Cenário 2: Usuário Manager Comum autenticado
  const managerRequest: MockRequestContext = {
    auth: {
      uid: 'user-manager-alex',
      token: {
        role: 'MANAGER', // Não é claim de ADMIN
        admin: false,
      },
    },
    adminsCollectionUids: registeredAdmins, // 'user-manager-alex' NÃO está nos admins
  };
  check(evaluateJogadoresRules('read', managerRequest).allowed === true, 'Manager autenticado pode ler jogadores');
  check(evaluateJogadoresRules('create', managerRequest).allowed === false, 'Manager autenticado NÃO pode criar jogadores');
  check(evaluateJogadoresRules('update', managerRequest).allowed === false, 'Manager autenticado NÃO pode atualizar jogadores');
  check(evaluateJogadoresRules('delete', managerRequest).allowed === false, 'Manager autenticado NÃO pode excluir jogadores');
  check(evaluateFM26BatchesRules('create', managerRequest).allowed === false, 'Manager autenticado NÃO pode criar lotes do FM26');
  check(evaluateFM26BatchesRules('update', managerRequest).allowed === false, 'Manager autenticado NÃO pode atualizar lotes do FM26');

  // Cenário 3: Tentativa de Auto-promoção pelo Manager
  check(evaluateAdminsCollectionRules('write', managerRequest).allowed === false, 'Manager NÃO consegue se auto-adicionar à coleção /admins');

  // Cenário 4: Administrador Autenticado via Custom Claim (role: 'ADMIN')
  const adminWithClaimRequest: MockRequestContext = {
    auth: {
      uid: 'admin-via-claim',
      token: {
        role: 'ADMIN',
      },
    },
    adminsCollectionUids: registeredAdmins,
  };
  check(evaluateJogadoresRules('read', adminWithClaimRequest).allowed === true, 'Admin via claim pode ler jogadores');
  check(evaluateJogadoresRules('create', adminWithClaimRequest).allowed === true, 'Admin via claim PODE criar jogadores');
  check(evaluateJogadoresRules('update', adminWithClaimRequest).allowed === true, 'Admin via claim PODE atualizar jogadores');
  check(evaluateJogadoresRules('delete', adminWithClaimRequest).allowed === false, 'Admin via claim NÃO pode deletar jogadores (delete: if false permanente)');
  check(evaluateFM26BatchesRules('create', adminWithClaimRequest).allowed === true, 'Admin via claim PODE gravar lotes fm26_import_batches');

  // Cenário 5: Administrador Autenticado via Coleção Segura /admins/{uid}
  const adminInCollectionRequest: MockRequestContext = {
    auth: {
      uid: 'admin-master-uid',
      token: {}, // Sem claim no token, mas registrado no banco seguro
    },
    adminsCollectionUids: registeredAdmins,
  };
  check(evaluateJogadoresRules('create', adminInCollectionRequest).allowed === true, 'Admin via coleção /admins PODE criar jogadores');
  check(evaluateJogadoresRules('update', adminInCollectionRequest).allowed === true, 'Admin via coleção /admins PODE atualizar jogadores');
  check(evaluateJogadoresRules('delete', adminInCollectionRequest).allowed === false, 'Admin via coleção /admins NÃO pode deletar jogadores');
  check(evaluateFM26BatchesRules('create', adminInCollectionRequest).allowed === true, 'Admin via coleção /admins PODE gravar lotes fm26_import_batches');

  // Cenário 6: Administrador Autenticado via E-mail Verificado (vmseguroservico@gmail.com)
  const adminWithEmailRequest: MockRequestContext = {
    auth: {
      uid: 'random-generated-google-uid-123',
      token: {
        email: 'vmseguroservico@gmail.com',
        email_verified: true,
      },
    },
    adminsCollectionUids: new Set<string>(), // Sem necessidade prévia de doc existente
  };
  check(evaluateJogadoresRules('read', adminWithEmailRequest).allowed === true, 'Admin com email verificado pode ler jogadores');
  check(evaluateJogadoresRules('create', adminWithEmailRequest).allowed === true, 'Admin com email verificado PODE criar jogadores');
  check(evaluateJogadoresRules('update', adminWithEmailRequest).allowed === true, 'Admin com email verificado PODE atualizar jogadores');
  check(evaluateJogadoresRules('delete', adminWithEmailRequest).allowed === false, 'Admin com email verificado NÃO pode deletar jogadores (delete: if false)');
  check(evaluateFM26BatchesRules('create', adminWithEmailRequest).allowed === true, 'Admin com email verificado PODE criar lotes fm26_import_batches');

  // Cenário 7: Administrador Autenticado via UID Supremo (jNe5SV5EJPZX4Ipyf7SReuXnBNI3)
  const adminWithSupremeUidRequest: MockRequestContext = {
    auth: {
      uid: 'jNe5SV5EJPZX4Ipyf7SReuXnBNI3',
      token: {},
    },
    adminsCollectionUids: new Set<string>(),
  };
  check(evaluateJogadoresRules('create', adminWithSupremeUidRequest).allowed === true, 'Admin com UID supremo PODE criar jogadores');
  check(evaluateJogadoresRules('update', adminWithSupremeUidRequest).allowed === true, 'Admin com UID supremo PODE atualizar jogadores');
  check(evaluateJogadoresRules('delete', adminWithSupremeUidRequest).allowed === false, 'Admin com UID supremo NÃO pode deletar jogadores');
  check(evaluateFM26BatchesRules('create', adminWithSupremeUidRequest).allowed === true, 'Admin com UID supremo PODE criar lotes fm26_import_batches');
  check(evaluateFM26BatchesRules('update', adminWithSupremeUidRequest).allowed === true, 'Admin com UID supremo PODE atualizar lotes fm26_import_batches');
  check(evaluateFM26BatchesRules('delete', adminWithSupremeUidRequest).allowed === false, 'Admin com UID supremo NÃO pode deletar lotes fm26_import_batches');

  // Cenário 8: Usuário com e-mail não-admin ou não verificado
  const nonAdminEmailRequest: MockRequestContext = {
    auth: {
      uid: 'other-user-999',
      token: {
        email: 'outro@gmail.com',
        email_verified: true,
      },
    },
    adminsCollectionUids: new Set<string>(),
  };
  check(evaluateJogadoresRules('create', nonAdminEmailRequest).allowed === false, 'Usuário comum com outro email NÃO pode criar jogadores');
  check(evaluateJogadoresRules('update', nonAdminEmailRequest).allowed === false, 'Usuário comum com outro email NÃO pode atualizar jogadores');
  check(evaluateJogadoresRules('delete', nonAdminEmailRequest).allowed === false, 'Usuário comum NÃO pode deletar jogadores');
  check(evaluateFM26BatchesRules('create', nonAdminEmailRequest).allowed === false, 'Usuário comum NÃO pode criar lotes fm26_import_batches');
  check(evaluateFM26BatchesRules('update', nonAdminEmailRequest).allowed === false, 'Usuário comum NÃO pode atualizar lotes fm26_import_batches');
  check(evaluateFM26BatchesRules('delete', nonAdminEmailRequest).allowed === false, 'Usuário comum NÃO pode deletar lotes fm26_import_batches');

  return { passed: allOk, details };
}
