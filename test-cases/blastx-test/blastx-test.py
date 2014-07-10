'''
Output query and subject sequences to be fed into blastx. The
complementary strand of the query should align to two separate domains in the
subject AA seq.

In an earlier version, running BLAST locally produced no results, while running
it via NCBI blastx (i.e., feeding the queries into the web interface) worked.
That does not seem to be an issue with this data sets, but the problem may
recur.
'''
import random
from dregs import binf
import sys

codon_table = binf.generate_codon_table()

def randseq(n, letters = ['A', 'C', 'G', 'T']):
  letters = list(letters)
  return ''.join([random.choice(letters) for i in range(n)])

def generate_spike(L):
  nt = ''
  aa = ''

  while len(aa) < L:
    cand_nt = randseq(3)
    cand_aa = codon_table[cand_nt]
    if cand_aa == '*':
      continue
    nt += cand_nt
    aa += cand_aa

  return (nt, aa)


def main():
  amino_acids = set(codon_table.values()) - set('*')

  spike_nt_1, spike_aa_1 = generate_spike(30)
  spike_nt_2, spike_aa_2 = generate_spike(40)
  #print(spike_nt_1, spike_aa_1, spike_nt_2, spike_aa_2, sep='\n')

  query = randseq(200) + binf.reverse_complement(spike_nt_2) + randseq(200) + binf.reverse_complement(spike_nt_1) + randseq(200)
  subj = randseq(100, amino_acids) + spike_aa_1 + randseq(100, amino_acids) + spike_aa_2 + randseq(120, amino_acids)

  binf.write_fasta_seq(sys.stdout, 'Q1', query)
  binf.write_fasta_seq(sys.stdout, 'S1', subj)

main()
