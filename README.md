Kablammo
========
Kablammo is a BLAST visualization tool. Given a set of BLAST results in XML
format, Kablammo will illustrate exactly which portions of the query sequence
(i.e., the sequence you gave BLAST) map to which portions of the subject
sequence (i.e., the sequence BLAST found in its database that aligns to your
input). This can be of considerable value in visualizing genome misassembly.

You may access an [already-deployed copy of Kablammo][kablammo]. For more
details, please see [my blog post on Kablammo][kablammo blog].


Running
=======
To run Kablammo, simply serve its directory via any static-file web server,
then access index.html in your browser. An easy means of deployment, then, is
thus:

1. Run `python3 -m http.server` or `python2 -m SimpleHTTPServer` from
   Kablammo's directory.
2. Access http://localhost:8000 in your web browser.


Serving BLAST results
=====================
Kablammo supports two means of loading BLAST XML results.

1. Kablammo allows the user to load a result set from her local machine; to
   make this work, the server administrator needn't do anything -- all processing
   is done on the client side, and never touches the server.

2. Kablammo allows the user to load a result set located on the server. This
   permits workflows in which BLAST is run on the server and the client visualizes
   the results in her web browser, without having to first download the
   XML-formatted results from the server. The result sets Kablammo lists are
   dictated by the `data/blast_results.json` file. To generate this file, put your
   BLAST result files (or symlinks to them) in the `data/` directory, then run
   `data/generate_list.py`.

Contact
=======
Reach me via [my web site][my site] or [on Twitter][my twitter].

[kablammo]: http://kablammo.wasmuthlab.org
[kablammo blog]: http://jeff.wintersinger.org/posts/2013/07/introducing-kablammo-a-blast-visualization-tool/
[my site]: http://jeff.wintersinger.org/
[my twitter]: http://twitter.com/jwintersinger
