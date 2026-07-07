/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/prize_pool_program.json`.
 *
 * RECONSTRUIDO A MANO a partir de lib.rs (anchor-lang 1.1.2) porque el build
 * no pudo correr en este entorno. Reemplázalo por el generado por `anchor build`
 * en cuanto WSL vuelva a funcionar.
 */
export type PrizePoolProgram = {
  "address": "DLo6qSd1fZ4D2T5cyeuDKSSWjgPcdGxwKVjTojEuL3N4",
  "metadata": {
    "name": "prize_pool_program",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initialize_tournament",
      "discriminator": [
        75,
        218,
        86,
        80,
        49,
        127,
        155,
        186
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  117,
                  114,
                  110,
                  97,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "admin"
              },
              {
                "kind": "arg",
                "path": "startgg_bracket_id"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "startgg_bracket_id",
          "type": "u32"
        },
        {
          "name": "entry_fee",
          "type": "u64"
        },
        {
          "name": "prize_percentages",
          "type": {
            "vec": "u8"
          }
        }
      ]
    },
    {
      "name": "register_player",
      "discriminator": [
        242,
        146,
        194,
        234,
        234,
        145,
        228,
        42
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              }
            ]
          }
        },
        {
          "name": "player_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "arg",
                "path": "startgg_entrant_id"
              }
            ]
          }
        },
        {
          "name": "player_wallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "startgg_entrant_id",
          "type": "u32"
        }
      ]
    },
    {
      "name": "refund_player",
      "discriminator": [
        251,
        32,
        76,
        233,
        171,
        106,
        120,
        46
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              }
            ]
          }
        },
        {
          "name": "player_record",
          "writable": true
        },
        {
          "name": "player_wallet",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "tournament"
          ]
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "distribute_prizes",
      "discriminator": [
        154,
        99,
        201,
        93,
        82,
        104,
        73,
        232
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "tournament"
          ]
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "winner_entrant_ids",
          "type": {
            "vec": "u32"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "TournamentAccount",
      "discriminator": [
        60,
        80,
        64,
        99,
        120,
        6,
        22,
        117
      ]
    },
    {
      "name": "PlayerRecord",
      "discriminator": [
        219,
        240,
        186,
        119,
        195,
        187,
        19,
        160
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "RegistrationClosed",
      "msg": "Las inscripciones de este torneo están cerradas."
    },
    {
      "code": 6001,
      "name": "InvalidEntryFee",
      "msg": "El entry fee debe ser mayor que cero."
    },
    {
      "code": 6002,
      "name": "MathOverflow",
      "msg": "Overflow aritmético al acumular fondos."
    },
    {
      "code": 6003,
      "name": "Unauthorized",
      "msg": "Solo el admin del torneo puede ejecutar esta acción."
    },
    {
      "code": 6004,
      "name": "InvalidPercentages",
      "msg": "Los porcentajes de premio deben ser de 1 a 10 posiciones y sumar exactamente 100."
    },
    {
      "code": 6005,
      "name": "TournamentClosed",
      "msg": "El torneo ya fue cerrado; los premios ya se repartieron."
    },
    {
      "code": 6006,
      "name": "WrongWinnerCount",
      "msg": "La cantidad de ganadores no coincide con los porcentajes definidos."
    },
    {
      "code": 6007,
      "name": "WinnerAccountMismatch",
      "msg": "Un ganador no coincide: el PlayerRecord o la wallet no corresponden a ese entrant."
    }
  ],
  "types": [
    {
      "name": "TournamentAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "startgg_bracket_id",
            "type": "u32"
          },
          {
            "name": "entry_fee",
            "type": "u64"
          },
          {
            "name": "total_funds",
            "type": "u64"
          },
          {
            "name": "is_open",
            "type": "bool"
          },
          {
            "name": "vault_bump",
            "type": "u8"
          },
          {
            "name": "prize_percentages",
            "type": {
              "vec": "u8"
            }
          }
        ]
      }
    },
    {
      "name": "PlayerRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tournament",
            "type": "pubkey"
          },
          {
            "name": "player_wallet",
            "type": "pubkey"
          },
          {
            "name": "startgg_entrant_id",
            "type": "u32"
          },
          {
            "name": "amount_paid",
            "type": "u64"
          }
        ]
      }
    }
  ]
};

export const IDL: PrizePoolProgram = {
  "address": "DLo6qSd1fZ4D2T5cyeuDKSSWjgPcdGxwKVjTojEuL3N4",
  "metadata": {
    "name": "prize_pool_program",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initialize_tournament",
      "discriminator": [
        75,
        218,
        86,
        80,
        49,
        127,
        155,
        186
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  117,
                  114,
                  110,
                  97,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "admin"
              },
              {
                "kind": "arg",
                "path": "startgg_bracket_id"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "startgg_bracket_id",
          "type": "u32"
        },
        {
          "name": "entry_fee",
          "type": "u64"
        },
        {
          "name": "prize_percentages",
          "type": {
            "vec": "u8"
          }
        }
      ]
    },
    {
      "name": "register_player",
      "discriminator": [
        242,
        146,
        194,
        234,
        234,
        145,
        228,
        42
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              }
            ]
          }
        },
        {
          "name": "player_record",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              },
              {
                "kind": "arg",
                "path": "startgg_entrant_id"
              }
            ]
          }
        },
        {
          "name": "player_wallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "startgg_entrant_id",
          "type": "u32"
        }
      ]
    },
    {
      "name": "refund_player",
      "discriminator": [
        251,
        32,
        76,
        233,
        171,
        106,
        120,
        46
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              }
            ]
          }
        },
        {
          "name": "player_record",
          "writable": true
        },
        {
          "name": "player_wallet",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "tournament"
          ]
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "distribute_prizes",
      "discriminator": [
        154,
        99,
        201,
        93,
        82,
        104,
        73,
        232
      ],
      "accounts": [
        {
          "name": "tournament",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tournament"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "tournament"
          ]
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "winner_entrant_ids",
          "type": {
            "vec": "u32"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "TournamentAccount",
      "discriminator": [
        60,
        80,
        64,
        99,
        120,
        6,
        22,
        117
      ]
    },
    {
      "name": "PlayerRecord",
      "discriminator": [
        219,
        240,
        186,
        119,
        195,
        187,
        19,
        160
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "RegistrationClosed",
      "msg": "Las inscripciones de este torneo están cerradas."
    },
    {
      "code": 6001,
      "name": "InvalidEntryFee",
      "msg": "El entry fee debe ser mayor que cero."
    },
    {
      "code": 6002,
      "name": "MathOverflow",
      "msg": "Overflow aritmético al acumular fondos."
    },
    {
      "code": 6003,
      "name": "Unauthorized",
      "msg": "Solo el admin del torneo puede ejecutar esta acción."
    },
    {
      "code": 6004,
      "name": "InvalidPercentages",
      "msg": "Los porcentajes de premio deben ser de 1 a 10 posiciones y sumar exactamente 100."
    },
    {
      "code": 6005,
      "name": "TournamentClosed",
      "msg": "El torneo ya fue cerrado; los premios ya se repartieron."
    },
    {
      "code": 6006,
      "name": "WrongWinnerCount",
      "msg": "La cantidad de ganadores no coincide con los porcentajes definidos."
    },
    {
      "code": 6007,
      "name": "WinnerAccountMismatch",
      "msg": "Un ganador no coincide: el PlayerRecord o la wallet no corresponden a ese entrant."
    }
  ],
  "types": [
    {
      "name": "TournamentAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "startgg_bracket_id",
            "type": "u32"
          },
          {
            "name": "entry_fee",
            "type": "u64"
          },
          {
            "name": "total_funds",
            "type": "u64"
          },
          {
            "name": "is_open",
            "type": "bool"
          },
          {
            "name": "vault_bump",
            "type": "u8"
          },
          {
            "name": "prize_percentages",
            "type": {
              "vec": "u8"
            }
          }
        ]
      }
    },
    {
      "name": "PlayerRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tournament",
            "type": "pubkey"
          },
          {
            "name": "player_wallet",
            "type": "pubkey"
          },
          {
            "name": "startgg_entrant_id",
            "type": "u32"
          },
          {
            "name": "amount_paid",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
