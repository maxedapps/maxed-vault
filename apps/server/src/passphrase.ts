const MIN_RECOMMENDED_PASSPHRASE_LENGTH = 14;

function countCharacterGroups(passphrase: string): number {
  const groups = [
    /[a-z]/.test(passphrase),
    /[A-Z]/.test(passphrase),
    /[0-9]/.test(passphrase),
    /[^A-Za-z0-9]/.test(passphrase),
  ];

  return groups.filter(Boolean).length;
}

function hasRepeatedSingleCharacter(passphrase: string): boolean {
  return new Set(passphrase).size === 1;
}

function isCommonSequence(passphrase: string): boolean {
  const lowered = passphrase.toLowerCase();
  const commonSequences = [
    "password",
    "qwerty",
    "letmein",
    "welcome",
    "admin",
    "123456",
    "abcdef",
  ];

  return commonSequences.some((sequence) => lowered.includes(sequence));
}

export function getWeakPassphraseWarning(passphrase: string): string | null {
  if (passphrase.length < MIN_RECOMMENDED_PASSPHRASE_LENGTH) {
    return `Weak passphrase warning: use at least ${MIN_RECOMMENDED_PASSPHRASE_LENGTH} characters for a vault passphrase.`;
  }

  if (countCharacterGroups(passphrase) < 3) {
    return "Weak passphrase warning: mix upper/lowercase letters, numbers, or symbols to make guessing harder.";
  }

  if (hasRepeatedSingleCharacter(passphrase) || isCommonSequence(passphrase)) {
    return "Weak passphrase warning: avoid common words, repeated characters, and simple keyboard sequences.";
  }

  return null;
}
