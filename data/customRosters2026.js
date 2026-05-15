const TEAM_ORDER = [12, 9, 4, 2, 7, 15, 1, 3, 5, 6, 8, 10, 11, 13, 14, 16, 17, 18];

const RAW_PLAYERS = `
Anthony Dimarco
Darren Saler
Rich Acerra
Connor Schmidt
Evan Rosenthal
Andrew Bianchi
Zach Schmidt
Frank LaRocca
Aaron Williams
Zachary Kane
Mike Cornacchia
Mark Karp
Stephen Epstein
Martin Blackburn
Zack Derosa
Ronnie Carlin
Brad Goldstein
Eric Rosenstock
Brett Easton
Marc Carlin
Bob Bilodeau
Mike Rosenstock
Steven Oran
Shawn Adelsberg
Lenny Sarcona
Logan Fauci
Dennis Oconnor
Chris Baldino
Justin Bykofsky
Nick Dinapoli
Jason Feingold
Robbie Juergens
Chip Costa
Seamus Coyle
John Maguire
Carlo Tanzola
Ken Feingold
John Fisher
Darren Wald
Gregory Deluise
Mike Conti
Mat Manochio
Lucas Preiss
Nick Deluise
Dan Manochio Jr
Patrick Thomas
Stephen Milhaven
Dan Manochio Sr
Michael Podolla
Ryan Ramirez
Tom Bongiovani
Raymond Porzio
Phil Corde
Ed Fradkin
Patrick Brock
Joe Picarello
Rob Corde
Nolan Ruthberg
Gary Szemcsak
Cameron Gille
Dylan Jacoby
Pat Pingaro
Justin Jacoby
Marc Persily
Jonathan Okun
Steve Santigate
Kyle Dunleavy
Seth Drashinsky
Jared Koshefsky
Max Allegretti
Dan Drashinsky
Jordan Brent
Justin Krauss
Kurt Schmidt
Russ Krauss
Matthew Leiggi
David Drashinsky
John Tesoriero
Nick Martino
Phillip Kuhner
Joel Zaretsky
Mitch Pollock
Austin Silverberg
Edwin Valentin
Matt Pollock
Holden Silverberg
Bryan Thompson
Mike Ferrarese
Josh Garcia
Rob Rozencwaig
Steven Frey
David Vignapiano
Fred Lugos
Mark Magariello
Mike Brullo
Matt Granese
Billy Loschiavo
Dave Wagreich
Todd Wallman
Ryan Wallman
Mike Steinberg
Dhimant Balar
Sudipta Ray
Paul Steinberg
Vince Caputo
Peter Kwiecinski
Joe Peragine
Joe Caputo
Evan Abramson
Jeff Goddard
Mark Goddard
Lawrence Rubin
Michael Weitsen
Michael Cruz
Justin Randell
Bruce Cotter
Brad Randell
Tom Carroll
Aj Ortiz
Tony Roegiers
Justin Colarocco
Jake Woloshyn
Ian Mcdermott
Kevin Murch
Nick Lapetina
Chris Karulski
Jake Kroese
Doug Cohen
Mike Iorio
Jerry Tilker
Eric Bomenblit
Michael Bernstein
Joe Tracey
Richie Bomenblit
Steve Ushkowitz
Jeff Martinez
Jeff Friedman
Rick Schindelheim
Emile Rythmel
Josh Walker
Joe Demaio
Brian Walker
Paul Kamras
Pablo Gonzales
Matt Hill
Mark Yutko
Jon Hempstead
Aj Greenspan
Adam Greenspan
Evan Steinberg
Andy Kessler
Ben Kessler
Steve Messina
Marcus Baquero
Daniel Kessler
David Unterweiser
Michael Kleschinsky Jr
Nick Villani
Mike Klecko
Kevin Kleschinsky
Jeremy Levine
Pete Kokoszka
Mike Villani
Jim Lombardi
Michael Kleschinsky Sr
Will Perez
Anthony Fazzino
Paul Lombardi
Nick Kleschinsky
Jeremy Paster
Anthony Foster
Ronnie Pacheco
Jordan Rosenthal
Brandon Tornetta
Juan Gallardo
Mike Ballo
Glen Marrone
Shawon Danser
Jordan Krant
Steven Wallenstein
David Kiste
Gary Klein
Ryan Amato
Shawn Leonardi
Bryan Frank
Dom Defalco
Espartaco Gonzalez
Piero Vescio
Dave Meyer
Jeff Mendelson
Craig Tepper
Daniel Navatta
Anthony Galiano
Mike Amato
Brian Frueh
Mike Santaromita
Christian Gaglio
Dave Polzer
Joe Pargament
Ryan Cumber
Andy Pargament
Rich Allen
Jeff Arnold
Brock Hor
Joel Podos
Lou Baffuto
Ralph Calabro
Jay Podos
Cole Fluta
Eric Becker
Joe Mamone
Jeff Beja
Matt Whelen
Alex Goldfarb
James Pezzulo
Chris Curti
Jesse Panassidi
Rich Hartly
Bill Chiusano
Reid Goldfarb
Joe Olivencia
Nick Turano
Eddie Fausak
Andrew Rodriguez
Anthony Turano
Joe Joraskie
Mike Heitzner
Joseph Lewicki
Jorge Rivera
Jake Heitzner
Vinny Spitaletto
Frank Ermel
Justin Bickoff
Pat Ciaglia
`;

const PLAYERS = RAW_PLAYERS.split("\n")
  .map((name) => name.trim())
  .filter(Boolean);

if (PLAYERS.length !== 234) {
  throw new Error(`Expected 234 players, found ${PLAYERS.length}`);
}

const canonicalRostersByTeamId = {};

TEAM_ORDER.forEach((teamId, teamIndex) => {
  const start = teamIndex * 13;
  const end = start + 13;
  canonicalRostersByTeamId[String(teamId)] = PLAYERS.slice(start, end);
});

module.exports = {
  canonicalRostersByTeamId,
};
