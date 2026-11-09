"""Modelo didático local. Não é contrato, blockchain, carteira ou auditoria."""
import json
from pathlib import Path


class Ledger:
    def __init__(self, supply, founder_percent, decimals):
        if type(supply) is not int or supply <= 0:
            raise ValueError("Oferta inválida")
        if type(founder_percent) is not int or not 0 <= founder_percent <= 100:
            raise ValueError("Participação inválida")
        if type(decimals) is not int or not 0 <= decimals <= 9:
            raise ValueError("Decimais inválidos")
        self.scale = 10 ** decimals
        self.supply = supply * self.scale
        if self.supply > 2**64 - 1 or self.supply * founder_percent % 100:
            raise ValueError("Oferta não representável")
        founder = self.supply * founder_percent // 100
        self.balances = {"fundador": founder, "destinacao_pendente": self.supply - founder}

    def transfer(self, sender, receiver, amount):
        # Amount is an integer number of the smallest token units, never float.
        if type(amount) is not int or amount <= 0:
            raise ValueError("Quantidade inválida")
        if not isinstance(receiver, str) or not receiver:
            raise ValueError("Destinatário inválido")
        if self.balances.get(sender, 0) < amount:
            raise ValueError("Saldo insuficiente")
        self.balances[sender] -= amount
        self.balances[receiver] = self.balances.get(receiver, 0) + amount

    def mint(self, amount):
        raise ValueError("Emissão adicional desabilitada neste modelo")


def run(config):
    ledger = Ledger(int(config["production_supply"]),
                    config["founder_allocation"]["percent"], config["test_decimals"])
    initial = dict(ledger.balances)
    checks = []

    def check(condition, name):
        if not condition:
            raise AssertionError(name)
        checks.append(name)

    def rejected(action, name):
        before = dict(ledger.balances)
        try:
            action()
        except ValueError:
            check(ledger.balances == before, name)
        else:
            raise AssertionError(name)

    check(initial["fundador"] == 5250000 * ledger.scale, "Reserva inicial de 5.250.000")
    check(initial["destinacao_pendente"] == 15750000 * ledger.scale,
          "15.750.000 com destinação ainda pendente")
    ledger.transfer("fundador", "participante_teste", 100 * ledger.scale)
    check(ledger.balances["participante_teste"] == 100 * ledger.scale,
          "Transferência fictícia de 100 unidades")
    ledger.transfer("participante_teste", "fundador", 100 * ledger.scale)
    ledger.transfer("fundador", "participante_teste", 1)
    check(ledger.balances["participante_teste"] == 1, "Transferência da menor fração")
    ledger.transfer("participante_teste", "fundador", 1)
    ledger.transfer("fundador", "fundador", 1)
    check(ledger.balances["fundador"] == initial["fundador"], "Autotransferência conserva saldo")
    rejected(lambda: ledger.transfer("fundador", "participante_teste", ledger.supply),
             "Saldo insuficiente rejeitado sem alterar saldos")
    for amount in (0, -1, 1.5, True):
        rejected(lambda: ledger.transfer("fundador", "participante_teste", amount),
                 "Quantidade inválida rejeitada: " + repr(amount))
    rejected(lambda: ledger.transfer("inexistente", "fundador", 1),
             "Conta sem saldo não transfere")
    rejected(lambda: ledger.mint(1), "Emissão extra rejeitada no modelo")
    check(sum(ledger.balances.values()) == ledger.supply, "Oferta total conservada")
    return {
        "status": "simulacao_local_concluida_nao_publicado",
        "spent_gbp": 0,
        "on_chain_transactions": 0,
        "supply_tokens": str(ledger.supply // ledger.scale),
        "founder_tokens": str(initial["fundador"] // ledger.scale),
        "unallocated_tokens": str(initial["destinacao_pendente"] // ledger.scale),
        "checks_passed": checks,
        "limitations": [
            "Modelo didático sem assinaturas, persistência de saldos ou conexão de rede.",
            "Os testes validam somente este modelo Python, não o programa Solana.",
            "Não foram criados token, carteira, preço, liquidez ou bloqueio de reserva na blockchain.",
            "Nenhuma distribuição dos 75% restantes foi decidida."
        ]
    }


if __name__ == "__main__":
    root = Path(__file__).parent
    report = run(json.loads((root / "felizcoin.config.json").read_text()))
    (root / "resultado-teste.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(report['checks_passed'])} verificações passaram. Gasto: £0. Transações na blockchain: 0.")
