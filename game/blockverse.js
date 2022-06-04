"use strict";
// ====================================
// Global Imports
import { version } from './core/globals.js'

// Math Imports
import { HALF_PI } from './math/constants.js';
import { Vector3 } from './math/vector.js';
import { Marsaglia, openSimplexNoise, PerlinNoise, seedHash, noiseSeed, noise, hash } from './math/noise.js';

// Renderer Imports
import { WebGL2Renderer } from './render/webgl2/gl2render.js';

// Block data Imports
import { blockData } from '../data/blockverse2/scripts/blocks.js'; // To-do: Use the packdata format over this.

// Shader Data Imports (Remove when dynamic shader loading is ready)
import { SOURCE as vertexShaderSrc3D } from '../assets/shaders/program0/VERTEX.js';
import { SOURCE as fragmentShaderSrc3D } from '../assets/shaders/program0/FRAGMENT.js';

import { SOURCE as vertexShaderSrc2D } from '../assets/shaders/program1/VERTEX.js';
import { SOURCE as fragmentShaderSrc2D } from '../assets/shaders/program1/FRAGMENT.js';
// ========================================
// Browser Compatibility Helpers
const AudioContext = window.AudioContext || window.webkitAudioContext;

// Error Manager
let isFirstError = true;
window.onerror = function(msg, url, line, col) {
  if (isFirstError) {
    document.body.innerHTML = `<h1>Error</h1>
                             <b>Error Given:</b> ${msg}<br>
                             <b>Source:</b> ${line}:${col} (${url})
                             <br>
                             <br>`;
    document.body.style = `background: rgb(0, 0, 255); 
                         color: white; 
                         font-family: monospace;`;
    
    isFirstError = false;
    return false;
  } // Mitigation
}

// Early Checks to ensure the games Core APIs are supported (Not Optional)
if (!navigator) {
  throw "Navigator API not supported";
} else if (!AudioContext) {
  throw "WebAudio API not supported";
}

// ========================================================
let minX, minY, minZ, maxX, maxY, maxZ; // Temporary globals to make strict mode work for now
let audio;
let renderer; // WebGL2Renderer Context, a WIP solution for easier rendering
let soundPlaying = false;

const maxLightLevel = 20; // We are trying a 0 - 20 Light Level System!
const lightLevelStep = 1 / maxLightLevel; // Step to give to the shader
let sky = [0.33, 0.54, 0.72] // 0 to 1 RGB color scale (default data is [0.33, 0.54, 0.72])
let currentSkyLightLevel = 1; // 1 = Max Exposure!
// =========================================================
const savebox = document.getElementById("savebox");
const boxCenterTop = document.getElementById("boxcentertop");
const message = document.getElementById("message");
const worldsDOM = document.getElementById("worlds");
const quota = document.getElementById("quota");
const canvas = document.getElementById("overlay");
const hoverbox = document.getElementById("onhover");
const contentManager = document.getElementById("content-manager");
const ctx2D = canvas.getContext("2d");

ctx2D.canvas.width = window.innerWidth
ctx2D.canvas.height = window.innerHeight

let setPixel, getPixels
const textures = {
    grassTop: function(n) {
        let r = 0,
            g = 0,
            b = 0,
            d = 0
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) {
                d = Math.random() * 0.25 + 0.65
                r = 0x54 * d
                g = 0xa0 * d
                b = 0x48 * d
                setPixel(n, x, y, r, g, b)
            }
        }
    },

    grassSide: function(n) {
        let r = 0,
            g = 0,
            b = 0,
            d = 0
        const pix = getPixels(textures.dirt); // Dirt texture duplicate fix lol

        const pix_ln = pix.length;
        for (let i = 0; i < pix_ln; i += 4) {
            setPixel(n, i >> 2 & 15, i >> 6, pix[i], pix[i + 1], pix[i + 2], pix[i + 3]);
        }

        for (let x = 0; x < 16; x++) {
            let m = Math.random() * 4 + 1
            for (let y = 0; y < m; y++) {
                d = Math.random() * 0.25 + 0.65
                r = 0x54 * d
                g = 0xa0 * d
                b = 0x48 * d
                setPixel(n, x, y, r, g, b)
            }
        }
    },
    leaves: function(n) {
        let r = 0,
            g = 0,
            b = 0,
            a = 0
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) {
                r = 0
                g = Math.floor(Math.random() * 30 + 100)
                b = Math.floor(Math.random() * 30)
                if (Math.random() < 0.45) {
                    a = 0
                } else {
                    a = 255
                }

                setPixel(n, x, y, r, g, b, a)
            }
        }
    },
    oakPlanks: function(n) {
        let r = 0
        for (let y = 0; y < 16; y++) {
            let a = (y & 3) === 3 ? 0.7 : 1
            for (let x = 0; x < 16; x++) {
                let mid = x === 8 && (y & 7) > 3 && a ? 0.85 : 1
                let rit = x === 15 && (y & 7) < 3 && a ? 0.85 : 1
                r = (Math.random() * 0.1 + 0.9) * a * mid * rit
                setPixel(n, x, y, 190 * r, 154 * r, 96 * r)
            }
        }
    },
    hitbox: function(n) {
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) {
                setPixel(n, x, y, 0, 0, 0, 255); // Hitbox Texture
            }
        }
    },
    dirt: "0g0g70ordrzz0u30g730wa4vzz0xnyl8f11lrk7315qj7jz1fh47pb6553365533033636350335403653650063306333633300635163503655353653535605335031350330553500033033366333433663663535336655335055335553353530355333033503300333336635353663650660554353355635155305303053556333333366353323553060365553063030663533555365534355335530",
    stone: "0g0g40sywflr0wb8hdr0zdjj0f13tzldr3333211210112222221212222220012121001110111222222233232233222111122111212333312223222222211010131223331331112222110010112211122233323223332222212232223332233332021211001212211122222332222233232111232112200101332112211122111321122222222233332222221123322122",
    logSide: "0g0g60fl1ssf0l5j1fj0qftm2n0wa7mdb14cs7wf16az8xr3143304330341432315230523034133230223052313113324032313232301342413230325232314343134131524131432313422343433143230343243342324331053324324242433315332332414303333432303231430331343230533053135133424052303323531343314231333343143340313114334314134131331432",
    logTop: "0g0g90l5j1fj0qftm2n0wa7mdb0z2esxr15quebj189da7z1cpma671f7ppfj1hzyayn1012101120110111077776768667777017334454555544811738877776777471164766666666756107576445544674601646636666466471165764655656756116576465464674610657646666566460164764434556756116576666666674610757767777787460175454444444447117776676686677711011101120110211",
    bedrock: "0g0g509gy58f0e7f7r30o8fd330rkrev31627mkf3111124324211212133434341443012110110111412224232433202422111112014111121134433112221221102211014432344323443410222122211011213234421122344344442110121213211143334134410144431102221123442334402111321134111112343420211101234433211211234421121011044312301123",
    glass: "0g0g50ybfh8f0znkiyo12rzshr1au95hb1lytipr4444444444444443411111111111111341114111111111104114111111111110413111111111111041111111111111124111111111111110411111111111111241111111111111124111111111111112411111111111111241111111111111123111111111111412411111111111411231111111111111133323222222222233",
    cobblestone: "0g0g60muaccf0r0pekf0un11q711vr5rz1a8mosf1ef1r0f2144011454313543145330554330132314342143342101321132113232134310021354131154443152453321033543234313433211243215332233213541231321542213533311021543232233121341323231101221044532211235411035532354215434213323154331432332113244323212332143111311232121135432",
    mossyCobble: "0g0gb0muaccf0mupnnj0p38xdr0r0pekf0rbmj9b0un11q70w1wkxr0y07svz11vr5rz1a8mosf1ef1r0f4199211276438a9619a8812764813858398951644251118533852182851464110531183233866642a176895308948428981498852118851988111851664158385117641484642305126244558824124185442111155214698112124761318998127651764653885847488164588511858685851588531841183352111338a984",
    stoneBricks: "0g0g70p2gyyn0rkrev30tj2nlr0xf9ou70zdjj0f12psrnj17g8flr5666666666665550645455555444445065454444445534406434554345434330632334544334324053244333345324302222222222222220110011000111111166666650566666663555544065455554544544306435354445544320634344454444343053345433332322305443344322222220222222221111110000111111",
    mossyStoneBricks: "0g0gc0mupnnj0p2gyyn0p38xdr0rbmj9b0rkrev30tj2nlr0w1wkxr0xf9ou70y07svz0zdjj0f12psrnj17g8flrab3668863b88a680b9a28683a9999332ba926363996a2931b9792a679a979721b737793993697591a72397773632297075225752332277924410441110000444886bbba1abbbb6883aaaa991ba9aaaa6a99a9971b97a7a399aa99351b797992a99997371a689a97777573371a897799755223791722757754000041110004400",
    bricks: "0g0g90vz62nz0yhavi712oqn7j13rinsv173m8lb193f4zj1b1w1rz1d7u7sv1j1u51b7742888777458777443513444435144410060033100503112256522225565222887747458777474214444315133333151341110600133105522225565522225677458887474588774435344444153444110511331106133325565222225652224777474287774745144444353444441501111106011111065222225655222566",
    coalOre: "0g0g70ehg7wf0hjr9j30j7xaf30sywflr0wb8hdr0zdjj0f13tzldr6556544543445666554536666553335454331453344511556665655105655644455443346545645556553215542143464552111065105555433556663334466661156543215455645565354100056665354514334663354455555666634106655443366412111054665105556005455554456665566544455555554655555566",
    ironOre: "0g0g80sywflr0wb8hdr0zdjj0f13tzldr1cpl2bj1gbvabj1o4exa71qwyvb33223211210112333221203333220002121005120011265223332322642322311122110013212312223220762217510131227655432542222100223330001133336523210762122312232021644423332021251001330021122222333301643322110033167666421332542223442122221123332233211122222221322222233",
    goldOre: "0g0g80sywflr0wb8hdr0zdjj0f13tzldr1x01czj1y6gem71z13ncv1z141z33223211210112333221203333220002121005120011265223332322642322311122110013212312223220762217610131227655432542222100223330001133336523210762122312232021644423332021251001330021122222333301643322110033167655421332642223442122221123332233211122222221322222233",
    diamondOre: "0g0g80h634zj0sagdtr0sywflr0wb8hdr0zdjj0f13tzldr1845xbz1ndl24f5445433432334555443425555442224343221342233461445554544604544533344332235434534445442764437632353447611054104444322445552223355556145432764344534454243600045554243413223552243344444555523605544332255367611043554604445004344443345554455433344444443544444455",
    redstoneOre: "0g0g90sywflr0wb8hdr0zdjj0f13oi67z13tzldr15wexa71b68mbj1f24cfz1yr4gsf4224211210112444221204444220002121005120011285224442422832422411122110014212412224220862218610141227655342532222100224440001144448524210862122412242021633324442021251001440021122222444401834422110044168655321442832224332122221124442244211122222221422222244",
    lapisOre: "0g0ga04hvenz04hvl6n04ihywv066fd3306r2ozj08z4sfz0sywflr0wb8hdr0zdjj0f13tzldr9889877876778999886669999886668787454386777813889889926329989977788776679867978889866428862576797861242398238888723679978767799993189872643386678998687222236258686627661237725788300799668893588779906612366339998700381039799887783339899877788888899888888899",
    emeraldOre: "0g0g7004swsf06mdmv30sywflr0wb8hdr0zdjj0f13tzldr1ohjdhb5445432232334555443445615442334343223310333422445555225555546133344361324555104445441061243255353445551054434444332232552323355555545461442244534444441053615224243433223310361344444556155551044223455103322553261334455444344441045554455433344554443544444455",
    ironBlock: "0g0gb1dawbnj1fj5rlr1hrdssf1m7r1mn1nlyvwf1pa4wsf1qe8xdr1s2ey9r1t6iyv31tqkz5r1ver01r32233333333222232aaaaa9998777772277777777777777105555555666444402aaaaaa999777771277777777777777105555566664444402aa9999977777771277777777777777105555555566644402aaaaaa999977771277777777777777105555556666444402aaaa9999777777127777777777777712222222112111111",
    goldBlock: "0g0g91kr8um71mphb0f1w77ain1xakkqn1ypvwu71yr43jz1yzk7pb1z0cef31z10mwv2222332223333221285577888776688125664877623324812564877462224471374777462264467137777462267762302877444667762330287444664462232037444664466222613744664466662461364667766666742032667762262776203267762332446261334462332666224132322332662264701101100011001100",
    diamondBlock: "0g0g90434min061d2in0h634zj0l2fpxb0sagdtr0vckf0f1845xbz1ndl24f1z141z33333223332222331378866777664477138445766432235713845766543335561265666543345546126666543346643203766555446643220376555445543323026555445544333412655445544443541245446644444653023446643343664302346643223554341225543223444335123233223443345601101100011001100",
    emeraldBlock: "0g0g606lfrb306mdmv307ei5fj07xmdbz0iaro5b10c5ptr0000000000000002055555454551144305000000200002430404555411114243050500000002425305050555445212130405054411421203040405451142120305040411020202130404041122120213042105410112420301212222222242030405510000441213012222222222224301011001110014532333333333333332",
    birchLogSide: "0g0g80f1fcov0qqliwv1gxap6n1o60u7z1ptrf271uar6db1uum5mn1z141z36643366634663366346666777634443677744367666636777732100136777737366321101377631211336344363331001266344677766532343777777334556376336775577775777764455577766336336777766634477636777767777577634436633667553210026677763443100000133377761132116331677764336336",
    birchLogTop: "0g0ga0mk6h3316m5am719xxgqn1cg9ce71f8hx4v1jowirj1nv4jcv1nvimm71tgjy7z1z141z39818811001809889966665657556666816223343444433718627766665666360153655555555645106465334433563580535525555355368154653544545645995465354353563599546535555455358853653323445645115465555555563510646656666676350064343333333336016665565575566688901188999811009",
    birchPlanks: "0g0g717znmrj19xxgqn1cg9ce71f8hx4v1jowirj1nv4jcv1nvimm75456666656666652554423455544553345554543333445522112210011010010563666636665443545543432344555543345444255544333001121000011121056654466666666535455554333434332654433334444335300122100012110006356655366636566445533433554544443345432554333330110012221010000",
    sand: "0g0g61m6x62n1nb9nnj1opn5dr1r80f7j1scbi0v1u0izgf4223213232132313122121130142502432011422222121122331213133132122125213232322122321223332123122121421151211022121212212212111242112322310131232124212221120212231202321232232012311223212331112121213132145321123323230232323221223235332323203223232332321223232",
    gravel: "0g0g80rufq4f0vqwlbz0zxiprz125i9rz15rvcan1627mkf1d0twqn1dackxr0341152512122521522122312102333522103133522351352232321522512322132741122210253202140133526552213104226515530122553253522311225353521223310256122311652152322132123553102521325022533562113225212132222537415525331025232422215235323311243310351274122232321212",
    blackConcrete: "0g0g40149on3028826702882yn028dp8f1330112022012232303130022112212111032203010022012122012222321221011223213030101033110011212233120230013131003200032022012002002112233122202312230200102211312102222122132011021201223320211021220121122122321331201102120210001220112022023302312210123220102110",
    blackWool: "0g0gf0149on3028826702882yn028dp8f03cc2rj03cc3jz03chptr04gg3cv04glqf305kk3y705kpr0f06oo4jj07ss54v08ww5q70a106bj46348b45ab13993299eebb7742570367bc77dc97bcbbdeb996bc768c47cc96ec9749bb115953bb31314c414641672547eebb8879bea7eeb966eebacc45bca9ccbb35ca4657528733577b117949ee7beeccbbecbacb799839349966bb445911796611cd318b9bee92badecb9717bc77cedc97c99beb559b6424c946cd76ac44bc",
    blueConcrete: "0g0g30c98pof0c98qgv0c9ecqn1000001101000201011001000101120101211111010200000001000110100100220110011001121111001100100100010200102101101000000011110001101010101011020111110000000101121111101100100100010110111010210111001101000100000111110100101111000120000010100000110001200110010002",
    blueWool: "0g0gj0c98pof0c98qgv0c9ecqn0c9edj30ddcr270ddidbz0ddie4f0ehgrnj0ehgsfz0ehmepr0ehmfi70flkt1b0flqfb30flqg3j0flw2db0flw35r0gpugov0gq02yn0gqbd3335237c44ac12992289iidc6632460256de67ge96cebbhic985ce657e46ee85ie9648cc114942cc21214e413541562436iidc7769dia6iic955iicaee34cea9eecb24ea4546427622466d116949ii7biieecciecaed699728249955cb344911695511eg217c9bii92bahiec9617be67eigf86e99cid449b5324e935eh65ae34de",
    brownConcrete: "0g0g30pl5gqn0qp3u9r0qp9hbz0211211202222221222122211211122121011102222222212211200222112101121111211111222121222122122221201212121222112122222221220222222122221201121212022122122110221211122221211011221212121010121011111212122221121221222212122112112112211010222111121211220222221122",
    brownWool: "0g0gi0qp3u9r0qp9hbz0rt7uv30rtdh4v0sxbunz0sxbvgf0u1a8zj0u1fv9b0v5e8sf0v5e9kv0v5jvun0w9i9dr0xdgmwv0xdm9z30yhkni70yhq9rz0zloo3j0zluadb35228d45bd12aa219bhhed7721570257ef77gfa7dfccghdb95df758f47ff95hfb749dd115a52dd21214f413541571526hhed887aehb7hhda55hhdbff25dfbbffdc25fb4557518722576e117b4bhh7chhffddhfdbfe7ab82924bb55dc245b116b5511fg218dachhb1cbghfda717cf77fhgg97fabdhe55ac5214fa25fg75bf24ef",
    cyanConcrete: "0g0g305objsv05obklb05oh6v31112010122111202100121222111122012212211101111202102221210222122211111211221111011021102021212212220211021022022201210110010212210211110202101010201110112020221222112102111202212110222110211221001010211001221212202222122111221102211100222112011211120220211",
    cyanWool: "0g0ge05obklb05oh6v305omt4v05omtxb05osg7305oy2gv05p3pj305p9bsv05p9clb05peyv305pkl4v05pklxb05pq87305pq8zj242269347912662167dda95521450145ab55cb659b88cd97649b546b35bb64db7536991146419921113b312431451424dda96656ad75dd9644dd97bb249b77bb9814b73445416521454a115737dd58ddbb99db97ba56762623774498234711474411bc116968dd7187cdb965158b55bdcc65b679da44684213b624bc547b23ab",
    grayConcrete: "0g0g20ehlvr30flk9a70000000000000000000000000000000000000000000000000000000000000000000000000000100100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000100000000000000000001000000010000",
    grayWool: "0g0gd0ehlvr30flk9a70flpvjz0flpwcf0flvim70gptwxr0gpzjzz0htxxj30hu3jsv0hu3klb0iy1y4f0iy7ke70iy7l6n333359337803663157cca85531350135ab55cb658b88cc87539b545b35bb53ca7535990036329930103b303330350335cc995556ac75cc8633cc87ba339b77ba8813a73435305532355a005737cc58ccab88cb87ba56753533773498333700574300ac205968cc7087cca865058b55bccc55b679ca33684313a634bc537a33ab",
    greenConcrete: "0g0g20k2mku70k2s73z0001000100111100101010100101101101101100111010010111001001011000100001100011000100101010110101111010000001011001001000100001010110101110010011010000101011110000010110101000000001010000110101011101000111110011101010011000111100001100011000000111101001101100",
    greenWool: "0g0gh0k2mku70k2s6bj0k2s73z0l6qjun0l6w64f0l71rlr0mb054v0mb5qm70mb5ren0nf9qf30nffcov0ojdq7z0ojjbpb0ojoxz30pnnbi70pnsxrz0rw0y6746447c45ab1499419aggcb8841580168ce88ee98bebbfgba96ce867e48ee96gda849cc125953cc41114e424642681546ggcc7789cga8ggb966ggbaed45ceaaedbb15da4658517843586c21894agg8bggdebbgebaec89a749449966cb445a116a6621de327c9bgga1bafgdb9828be88egee98e9acgc559b6414d946ef86ad44ce",
    lightBlueConcrete: "0g0g3090ti4f090z4e70a4xipr2120111111121222222121122112211121121211112221221111102221122212112021111111122111112111112121211222221111122121212121112021122112211121211211111121220111212121111121222001122211222221022122111011221111111021211221211211121112212111111122121111211112222111",
    lightBlueWool: "0g0gq090z4e70a4xipr0a534zj0a58r9b0b974sf0b9crun0b9ie4f0cdgrnj0cdmepr0cds0zj0dhqein0dhw0sf0dhw1kv0em01dr0em5nnj0fq9o8v0fqfain0gudou70gujb3z0hyhon30hynawv0hynbpb0j2lp8f0j2rbi70k6pptr0latpmn7b57fm89ik26ff63fippnkdd739d04benodepogdkojjppkifblodcfo8doofbpoie8fml21af95mm62428o817b81bd397cppmlffefnpidppkgbbppkioo79loiiookj4aoi8cad93fd55adcn22dh8ippejppookkpokiondfif6f68hhbcmj78ai22cicb22op51fmfjppi3jippokfd2ejoeeoppofdofilpn9agjc738og7copebio78no",
    lightGrayConcrete: "0g0g20yjgg730yjggzj1000110001001010100010000000011101100010001001011010001100101010001000000000000010100000000100010100000000001010100010001000000000100000110000100001100000011101110001001011001001001001011000000000011001001001001010000000010000000010100110000000001000001001",
    lightGrayWool: "0g0gi0yjgg730yjggzj0znkgsf0znkhkv10rohdr10roi6711vshz311vsirj11vy5tr12zwjcv12zwk5b1440jy7144670f1584kjj1584lbz16c8l4v16c8lxb17gclq745339e55bd1399329bhhfd7732570257ff78hfa7dfcchhdb95df769f57ff95hfb759ed115953ee31215f514551572537hhed9979fhb7hhda55hhdbff35dfbbgfdc25fb5657529733577f117b5bhh8chhfgddhfdbgf79b93935bb56ec355b117b6511fh319e9chhb2cbhhfd9718cf78fhhg97f9bdhf55ac6325fa36fh75bf35ff",
    limeConcrete: "0g0g30ppd5a70ppirjz0qth5331121111111100111111111110111110111010211100110111211111211101111112111111111111101110111011110211011011110111110102111110100111000110112112110211112112112111212111111111111111011111011100101111111111212111111111112010011011221111111110111120011110111101111",
    limeWool: "0g0gg0ppirjz0qth5330qtmrcv0rxl4vz0rxqr5r0t1p4ov0t1uqyn0u5t4hr0u5yqrj0v9x4an0va2qkf0we143j0xi53wf0ym3hfj0ym94hr10uh5of35237c44bb1299228affcb6632460257cd67ed96bdbbefba85bd657d46dd85fca748cb104942cc21214d403540562435ffcb7779cfb6ffb955ffbbdc34bdbaecbb24cb4546427622465c01694aff7bffcebbfdbbec69a728249955cb344a105a5501ce207c9bffa2bbefcb9607bd77dfee86d9abfc449b5324c935de75bc34cd",
    magentaConcrete: "0g0g419jw2rj1anugan1ao02kf1ao03cv2233313332221332333333233213322333223332331233333313323103121223222131233211303233130230322231223302323103002220333103232232223333313231221331233333231232212303302330122232333333332123320111033031332321233232303322232223332223231233212323332233222231230323",
    magentaWool: "0g0gs1ao02kf1ao03cv1brygvz1bs435r1bs43y71cw2hhb1cw83r31cw84jj1e06i2n1e0c4cf1e0c54v1f4ainz1f4g4xr1f4g5q71g8ej9b1g8k5j31g8k6bj1hcijun1hco64f1hco6wv1igmkfz1igs6pr1igs7i71jkw7b31jkw83j1kp08ov1lt49a71mxdwxr6945dl77ij14ff43ehrrmjba537a039cmoacqogajojjqrjhe9koa9do7booe9rnhc7elk118f74ll41317o7169719a275arrmkddcfmribrrjg99rrjion57koihonjj38ni798a72db448bam11bh7hrrcjrrnojjrojiomafhd4e47hh99lj578h11ah9911nq41dlfjrrh2jiqrnjfa1cjoccorqpebofhkrm78gj9537ng59oqc9in57mo",
    orangeConcrete: "0g0g21p59iwv1q97wfz1011110111101111111011111110000111101110100111111110011111011001001101110110111111111110111111011111101110111111110111111111111111011110111101111011101101101111010010111111110110101110010011101111111010101001101111111011111110111111111001111111101111111111",
    orangeWool: "0g0gm1q97wfz1rdbw8v1rdbx1b1rdhjb31shfwu71shfxmn1tljxfj1tljy7z1tlpkhr1upnytb1uptl331uptlvj1vtrzen1vtxlof1vtxmgv1wy1m9r1wy1n271wy79bz1wycwe71wyijgf1wyo5q71wytssf46239f55de02aa219dllhe8731570268hi79kib7eieelled96fi779i58ii96lhd859ff005a52ff20205i504650671537llgf998ahld8lleb66lledih35fiddihee25hd5757519822587h008c5dll9ellhieeliedih7ad92925cc67fe355d007d7600hk209faelld1edllhea709ei89ilkj98iadflh55be7315hb37il86dh35hi",
    pinkConcrete: "0g0g31ltks8v1mxj5rz1mxj6kf1122212121112211111211211211122112111221111111121211212111122211111112112121112111111111111112111212221121111111212211112101110212211211122111211112212111211110211211211211111111121212221211121111112212211121211111211212211111111111121112111211212122122111",
    pinkWool: "0g0gv1mxj6kf1o1hk3j1o1n6db1p5r6yn1q9v6rj1q9v7jz1rdz7cv1re4uf31si37y71si8u7z1tm78jj1tmcutb1tmcvlr1uqgven1uqmigv1uqs4qn1vuqj271vuw5bz1vuw64f1vv1se71vv7fgf1vvd1q71vvd2in1vviosf1vvipkv1vvobun1vvocn31vvtywv1vvzlz31vw588v1vw591b6a46em78jk25gg53fjuuokdc638c03adoqcesqhckqkktukjfalqcbeq7dqqfaupjd7fml219g83mm52327q716a71ac386buunleedgoujduukhaauukjqp68lqjjrpkk39pj7b9c83ed439dbo12di7juuekuuprkkuqkjrocgje5f57iiabmk679j22bjba12ps31emgkuuj3kjtupkgc1ekqdequssfdqgjluo89hkb637ph6bqtdajp67oq",
    purpleConcrete: "0g0g40qo16v30rrzke70rrzl6n0rs57gf3222322033323333333312320220233231302222232332333202332233033330333322320012333323333330233022223332223332223232323303323233332332021220323110033223333322032332312323332322322202232223033232221223233023333332022233332332233232023333233223032323332323323332",
    purpleWool: "0g0gm0rrzl6n0rs57gf0sw3kzj0sw3lrz0u01zb30u07lkv0u07mdb0v45zwf0w84dfj0w84e7z0xc8e0v0xc8etb0yg6scf0ygcem70zkasxr10o96gv10o979b10oetj311sd72711sd7un12wh8fz154uxhb47349e45ce13aa32acllfe8742570279fh79jhb7ehddkleca7eh779h48hha7lgc94aee116a52ee31214h414741771547llfe999aflc8lleb77llechg45ehcchged26gc4767519832687f118c4cll9dllgheelhechf7ac93a34cc77ed446c117c7711gj219eadllc1dcklgea719dh99hljia8hacelf56bd7424gb47hk97cg44fh",
    redConcrete: "0g0g112voa9r0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    redWool: "0g0gd12voa9r13zmnsv153l1bz167jev3167p14v17bnenz18fls7319jprzz1ano5j31ano6bj1brmjun1brs64f1f3yku7241258227712662157cc9754212401459b45bb647b77bc77548b445b25bb54ca7525881036218821112b202420441224cc8855569c75cc7644cc77ba228b77ba7713a724342155113549015627cc57ccab77cb77b946752522664487223711474401ab105867cc7177bca764057b55bcbb55b678c923674212a624bb547a229b",
    whiteConcrete: "0g0g31ktui9r1ku04jj1lxyi2n1121212211221121111221111121122111211111121112111212112211111211212222111111221112211112101110211111122211211211111111212221111112212121212222111121122211111111222111111112121222121111111111211121221112221111121222121112212122111221211212111121221211221212",
    whiteWool: "0g0gn1lxyi2n1lxyiv31ly454v1n22inz1n22jgf1n285q71o66j9b1o66k1r1o6c6bj1paajun1qeekfz1ricyrj1riil1b1smgykf1smmlmn1tqkz5r1tqqm7z1uuozr31uuumtb1vyt0cf1vyynen1x2x0xr1y711j37a56dj89hi26ee63egmmliba639a04acllacmlfailiimmigeajlaadl8blleamlgc8ejj219e94jj62429l817a81aa396ammkjddcelmhbmmifaammihll69jlhgllii49lh8a9a93db549bal12bg8gmmcimmlliimlihllaegd6e68ggaaji689g22agaa12lm41djeimmg3ihmmliea1cilcclmmmeblegjml99fia638lf6almcahl68ll",
    yellowConcrete: "0g0g41to1w5b1us09of1us5vy71us5wqn2111111122222221232021021213122222211020112110121211022201012212122222312211221122213110202011133121132211112221221211211111112120231210211111201132001211212111211102220222021102211223011100222121202222222132111211111112111112021121120222221222011012122121",
    yellowWool: "0g0gj1us5vy71usbj0f1vw9wjj1vwfitb1vwfjlr1vwl5vj1vwl6nz1vwqsxr1x0p6gv1x0utj31x10fsv1x10glb1x163nj1y54h6n1y5a48v1y5a51b1y5frb31y5fs3j1y5lf5r45239e44bc0299219biiec7731470158eg78hga7cgcchicb95dg759g47gg95ifb849ed005942ee20104g404540571436iied9989eib7iica55iicbgf34dgbbgfcc15fb4557419722576e007b4bii8ciifgccigcbge79b92924bb55ec345b006b5500fh209e9ciib1cbhifc9708cg88gihh97g9bdie45ac5314fa35gh85bf34eg",
    bookshelf: "0g0gt03fxnnj04laqdb0a0ot1b0b6j6db0c8r6db0deww730df88ov0egz6rj0gpo9330ht5kov0k20av30nf40zj0pnc1dr0qoh8fz0sy416n0w8kcn30wc5n9b0yicu0v11vb08v11vskcf13z03jz16atkvz17fehvj1as1ce71czhmv31e50qv31g6nvgf1gbtpfj1ks44qnommllhlllmmmmlmoo44477444772534oo799kk999ni9637olkffqk99gpjk631lsqffqk64gnik631soqfdqf6gcngf651ookd9kf3c7igf350mlorrsssroorrroolollmmhmllmmmllhoo77227cb7427724ooqk763gck99cb97olpj063gckq4gc10hsqk063a8fqkgcpjsoqf065a87kqgc10omkfe35ccefkcb03oorrsssroorrrrooo",
}

const BLOCK_COUNT = blockData.length;

//Set defaults on blockData
(function() {
    for (let i = 1; i < BLOCK_COUNT; i++) {
        let data = blockData[i]
        data.id = i

        if (!data.textures) {
            data.textures = [data.name, data.name, data.name, data.name, data.name, data.name]
        } else if (typeof data.textures === "string") {
            let texture = data.textures
            data.textures = [texture, texture, texture, texture, texture, texture]
        } else if (data.textures.length === 3) {
            data.textures[3] = data.textures[2]
            data.textures[4] = data.textures[2]
            data.textures[5] = data.textures[2]
        } else if (data.textures.length === 2) {
            // Top and bottom are the first texture, sides are the second.
            data.textures[2] = data.textures[1]
            data.textures[3] = data.textures[2]
            data.textures[4] = data.textures[2]
            data.textures[5] = data.textures[2]
            data.textures[1] = data.textures[0]
        }

        data.transparent = data.transparent || false
        data.shadow = data.shadow !== undefined ? data.shadow : true
    }
})()

let win = window.parent;
let doc = document;
let console = win.console;
let world;

let worldSeed

// P.JS Ported/Used Code
let currentRandom = null
function randomSeed(seed) {
    currentRandom = (new Marsaglia(seed)).nextDouble
}

function random(min, max) {
    if (!max) {
        if (min) {
            max = min
            min = 0
        } else {
            min = 0
            max = 1
        }
    }
    return currentRandom() * (max - min) + min
}

let caveNoise;

function fill(r, g = r, b = r, a = 1) {
    ctx2D.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
}

function rect(x, y, w, h) {
    ctx2D.fillRect(x, y, w, h);
}

function stroke(r, g, b) {
    if (!g) {
        g = r
        b = r
    }

    ctx2D.strokeStyle = `rgb(${r}, ${g}, ${b})`;
}

function line(x1, y1, x2, y2) {
    ctx2D.moveTo(x1, y1)
    ctx2D.lineTo(x2, y2)
}

function text(txt = 'NO TEXT DATA GIVEN', x, y, h) {
    h = h || 0

    const lines = txt.split("\n");
    const lines_ln = lines.length;
    for (let i = 0; i < lines_ln; i++) {
        ctx2D.fillText(lines[i], x, y + h * i)
    }
}

function textSize(size = '24') {
    ctx2D.font = size + 'px Monospace' // Default is monospace
}

function textAlign(mode = "left") {
    ctx2D.textAlign = mode;
}

function strokeWeight(num) {
    ctx2D.lineWidth = num
}

const ARROW = "arrow"
const HAND = "pointer"
const CROSS = "crosshair"

function cursor(type) {
    canvas.style.cursor = type
}

randomSeed(Math.random() * 10000000 | 0);

async function createDatabase() {
    return await new Promise(async (resolve, reject) => {
        let request = window.indexedDB.open("MineKhan", 1)

        request.onupgradeneeded = function(event) {
            let DB = event.target.result
            // Worlds will contain and ID containing the timestamp at which the world was created, a "saved" timestamp,
            // and a "data" string that's identical to the copy/paste save string
            let store = DB.createObjectStore("worlds", {
                keyPath: "id"
            })
            store.createIndex("id", "id", {
                unique: true
            })
            store.createIndex("data", "data", {
                unique: false
            })
        }

        request.onsuccess = function(e) {
            resolve(request.result)
        }

        request.onerror = function(e) {
            console.error(e)
            reject(e)
        }
    })
}

async function loadFromDB(id) {
    return await new Promise(async (resolve, reject) => {
        let db = await createDatabase()
        let trans = db.transaction("worlds", "readwrite")
        let store = trans.objectStore("worlds")
        let req = id ? store.get(id) : store.getAll()
        req.onsuccess = function(e) {
            resolve(req.result)
            db.close()
        }
        req.onerror = function(e) {
            resolve(null)
            db.close()
        }
    })
}

async function saveToDB(id, data) {
    return new Promise(async (resolve, reject) => {
        let db = await createDatabase()
        let trans = db.transaction("worlds", "readwrite")
        let store = trans.objectStore("worlds")
        let req = store.put({
            id: id,
            data: data
        })
        req.onsuccess = function() {
            resolve(req.result)
        }
        req.onerror = function(e) {
            reject(e)
        }
    })
}

async function deleteFromDB(id) {
    return new Promise(async (resolve, reject) => {
        let db = await createDatabase()
        let trans = db.transaction("worlds", "readwrite")
        let store = trans.objectStore("worlds")
        let req = store.delete(id)
        req.onsuccess = function() {
            resolve(req.result)
        }
        req.onerror = function(e) {
            reject(e)
        }
    })
}

function save() {
    saveToDB(world.id, {
        id: world.id,
        edited: Date.now(),
        name: world.name,
        version: version,
        code: world.getSaveString()
    }).then(() => world.edited = Date.now()).catch(e => console.error(e))
}

// Globals
const reach = 5 // Max distance player can place or break blocks
let superflat = false
let trees = true
let caves = true

let blockIds = {}
blockData.forEach(block => blockIds[block.name] = block.id)

let currentFov

// Configurable and savable settings
let settings = {
    renderDistance: 4, // Render Distance (4 Chunks is default)
    fov: 70, // Field of view in degrees
    mouseSense: 100 // Mouse sensitivity as a percentage of the default
}

let locked = true
let generatedChunks
let mouseX, mouseY, mouseDown
let width = window.innerWidth
let height = window.innerHeight

const generator = {
    height: 192, // Height of the hills
    smooth: 0.006, // Smoothness of the terrain
    extra: 30, // Extra height added to the world.
    caveSize: 0.00 // Redefined right above where it's used
}

const maxHeight = 255;
let blockOutlines = false
let blockFill = true
let updateHUD = true
const CUBE = 0;
const SLAB = 0x100; // 9th bit
const STAIR = 0x200; // 10th bit
const FLIP = 0x400; // 11th bit
const NORTH = 0; // 12th and 13th bits for the 4 directions
const SOUTH = 0x800;
const EAST = 0x1000;
const WEST = 0x1800;
const ROTATION = 0x1800; // Mask for the direction bits
let blockMode = CUBE;
let tex
let textureMap
let dirtBuffer
let dirtTexture
let textureCoords
let texCoordsBuffers
let dirtbg // Background image
let bigArray = win.bigArray || new Float32Array(600000)
win.bigArray = bigArray

// Callback functions for all the screens; will define them further down the page
let drawScreens = {
    "main menu": () => {}, // Title Screen
    "options": () => {}, // Options Menu
    "content": () => {}, // Content Manager for Blockverse (WIP)
    "play": () => {}, // Game Itself
    "pause": () => {}, // Pause Screen
    "creation menu": () => {}, // Create World Menu
    "inventory": () => {}, // Creative Menu
    "multiplayer menu": () => {}, // Multiplayer Placeholder
    "comingsoon menu": () => {}, // A Placeholder builtin by Willard
    "loadsave menu": () => {}, // World Selection
}

const html = {
    pause: {
        enter: [message],
        exit: [savebox, message]
    },
    "content": {
      enter: [contentManager],
      exit: [contentManager],
      onenter: () => {
        
      }
    },
    "loadsave menu": {
        enter: [worldsDOM, quota],
        exit: [worldsDOM, quota],
        onenter: () => {
            audio = new AudioContext(); // Start Audio Engine
            if (navigator.storage && navigator.storage.estimate) {
                navigator.storage.estimate().then(data => {
                    quota.innerText = `${data.usage.toLocaleString()} / ${data.quota.toLocaleString()} bytes (${Math.round((100 * data.usage / data.quota).toLocaleString(undefined, { maximumSignificantDigits: 2 }))}%) of your quota used`
                }).catch(console.error)
            }
          
            savebox.onmousedown = e => {
                let elem = document.getElementsByClassName("selected")
                if (elem && elem[0]) {
                    elem[0].classList.remove("selected")
                }
                selectedWorld = 0
                Button.draw()
            }
        },
        onexit: () => {
            savebox.onmousedown = null
        }
    },
    "creation menu": {
        enter: [savebox],
        exit: [savebox],
        onenter: () => {
            savebox.placeholder = "Enter World Name"
            savebox.value = ""
        }
    },
    loading: {
        onenter: startLoad
    },
    editworld: {
        enter: [savebox],
        exit: [savebox],
        onenter: () => {
            savebox.placeholder = "Enter World Name"
            savebox.value = ""
        }
    }
}

let screen = "main menu";
let previousScreen = screen;

function changeScene(newScene) {
    if (screen === "options") {
        saveToDB("settings", settings).catch(e => console.error(e))
    }

    if (html[screen] && html[screen].exit) {
        for (let element of html[screen].exit) {
            element.classList.add("hidden")
        }
    }

    if (html[newScene] && html[newScene].enter) {
        for (let element of html[newScene].enter) {
            element.classList.remove("hidden")
        }
    }

    if (html[newScene] && html[newScene].onenter) {
        html[newScene].onenter()
    }
    if (html[screen] && html[screen].onexit) {
        html[screen].onexit()
    }

    previousScreen = screen
    screen = newScene
    mouseDown = false
    drawScreens[screen]()
    Button.draw()
    Slider.draw()
}
let hitBox = {}
let holding = 0
let Key = {}
let modelView = win.modelView || new Float32Array(16)
win.modelView = modelView
let glUniforms // Originally glCache, renamed for clarity
let worlds, selectedWorld = 0
let freezeFrame = 0
let p
let vec1 = new Vector3(),
    vec2 = new Vector3(),
    vec3 = new Vector3()
let move = {
    x: 0,
    y: 0,
    z: 0,
    ang: Math.sqrt(0.5),
}
let p2 = {
    x: 0,
    y: 0,
    z: 0,
}
let place
let inventory = {
    hotbar: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    main: [],
    hotbarSlot: 0,
    size: 40 * Math.min(width, height) / 600,
    holding: 0,
}
//}

function play() {
    canvas.onblur()
    p.lastBreak = Date.now()
    updateHUD = true
    use3d()
    gl.clearColor(sky[0], sky[1], sky[2], 1.0)
    getPointer()
    fill(255, 255, 255)
    textSize(10)
    changeScene("play")
}

let gl; // WebGL2 Context (Fixes scope issues)

function getPointer() {
    if (canvas.requestPointerLock) {
        canvas.requestPointerLock()
    }
}

function releasePointer() {
    if (doc.exitPointerLock) {
        doc.exitPointerLock()
    }
}

// Data to make things Easier (Rendering?)
const Block = {
    top: 0x4,
    bottom: 0x8,
    north: 0x20,
    south: 0x10,
    east: 0x2,
    west: 0x1,
}

const Sides = {
    top: 0,
    bottom: 1,
    north: 2,
    south: 3,
    east: 4,
    west: 5,
}

/*
  These are the programs for the engine. This change was done to account for mods (Content) that need custom shader code
  or shaders that overhaul the graphics (while limited in its capicity, I hope to get higher-end effects on this engine soon)
  Slot Overlay:
    - Slot 0 = Hardcoded programs3D
    - Slot 1 = Hardcoded programs2D
    - Slot 2+ = Settable programs that can be added by mods (WIP)
*/
let programs = []; 


function objectify(x, y, z, width, height, textureX, textureY) {
    return {
        x: x,
        y: y,
        z: z,
        w: width,
        h: height,
        tx: textureX,
        ty: textureY
    }
} 

const shapes = {
    /*
    	[
    		[(-x, -z), (+x, -z), (+x, +z), (-x, +z)], // minX = 0,  minZ = 2,  maxX = 6, maxZ = 8
    		[(-x, +z), (+x, +z), (+x, -z), (-x, -z)], // minX = 9,  minZ = 10, maxX = 3, maxZ = 4
    		[(+x, +y), (-x, +y), (-x, -y), (+x, -y)], // minX = 6,  minY = 7,  maxX = 0, maxY = 1
    		[(-x, +y), (+x, +y), (+x, -y), (-x, -y)], // minX = 9,  minY = 10, maxX = 3, maxY = 4
    		[(+y, -z), (+y, +z), (-y, +z), (-y, -z)], // minY = 10, minZ = 11, maxY = 4, maxZ = 5
    		[(+y, +z), (+y, -z), (-y, -z), (-y, +z)]  // minY = 7,  minZ = 8,  maxY = 1, maxZ = 2
    	]
    	*/
    cube: {
        verts: [
            // x, y, z, width, height, textureX, textureY
            // 0, 0, 0 is the corner on the top left of the texture
            [objectify(0, 0, 0, 16, 16, 0, 0)], //bottom
            [objectify(0, 16, 16, 16, 16, 0, 0)], //top
            [objectify(16, 16, 16, 16, 16, 0, 0)], //north
            [objectify(0, 16, 0, 16, 16, 0, 0)], //south
            [objectify(16, 16, 0, 16, 16, 0, 0)], //east
            [objectify(0, 16, 16, 16, 16, 0, 0)] //west
        ],
        cull: {
            top: 3,
            bottom: 3,
            north: 3,
            south: 3,
            east: 3,
            west: 3
        },
        texVerts: [],
        varients: [],
        buffer: null,
        size: 6
    },
    slab: {
        verts: [
            [objectify(0, 0, 0, 16, 16, 0, 0)], //bottom
            [objectify(0, 8, 16, 16, 16, 0, 0)], //top
            [objectify(16, 8, 16, 16, 8, 0, 0)], //north
            [objectify(0, 8, 0, 16, 8, 0, 0)], //south
            [objectify(16, 8, 0, 16, 8, 0, 0)], //east
            [objectify(0, 8, 16, 16, 8, 0, 0)] //west
        ],
        cull: {
            top: 0,
            bottom: 3,
            north: 1,
            south: 1,
            east: 1,
            west: 1
        },
        texVerts: [],
        buffer: null,
        size: 6,
        varients: [],
        flip: true,
        rotate: false
    },
    stair: {
        verts: [
            [objectify(0, 0, 0, 16, 16, 0, 0)], //bottom
            [objectify(0, 8, 8, 16, 8, 0, 8), objectify(0, 16, 16, 16, 8, 0, 0)], //top
            [objectify(16, 16, 16, 16, 16, 0, 0)], //north
            [objectify(0, 8, 0, 16, 8, 0, 0), objectify(0, 16, 8, 16, 8, 0, 0)], //south
            [objectify(16, 8, 0, 8, 8, 8, 0), objectify(16, 16, 8, 8, 16, 0, 0)], //east
            [objectify(0, 8, 8, 8, 8, 0, 0), objectify(0, 16, 16, 8, 16, 8, 0)] //west
        ],
        cull: {
            top: 0,
            bottom: 3,
            north: 3,
            south: 0,
            east: 0,
            west: 0
        },
        texVerts: [],
        buffer: null,
        size: 10,
        varients: [],
        flip: true,
        rotate: true
    },
}

function compareArr(arr, out) {
    let minX = 1000
    let maxX = -1000
    let minY = 1000
    let maxY = -1000
    let minZ = 1000
    let maxZ = -1000
    let min = Math.min
    let max = Math.max
    let num = 0
    for (let i = 0; i < arr.length; i += 3) {
        num = arr[i]
        minX = minX > num ? num : minX
        maxX = maxX < num ? num : maxX
        num = arr[i + 1]
        minY = minY > num ? num : minY
        maxY = maxY < num ? num : maxY
        num = arr[i + 2]
        minZ = minZ > num ? num : minZ
        maxZ = maxZ < num ? num : maxZ
    }
    out[0] = minX
    out[1] = minY
    out[2] = minZ
    out[3] = maxX
    out[4] = maxY
    out[5] = maxZ
    return out
}

function initShapes() {
    function mapCoords(rect, face) {
        let x = rect.x
        let y = rect.y
        let z = rect.z
        let w = rect.w
        let h = rect.h
        let tx = rect.tx
        let ty = rect.ty
        let tex = [tx + w, ty, tx, ty, tx, ty + h, tx + w, ty + h]
        let pos = null
        switch (face) {
            case 0: // Bottom
                pos = [x, y, z, x + w, y, z, x + w, y, z + h, x, y, z + h]
                break
            case 1: // Top
                pos = [x, y, z, x + w, y, z, x + w, y, z - h, x, y, z - h]
                break
            case 2: // North
                pos = [x, y, z, x - w, y, z, x - w, y - h, z, x, y - h, z]
                break
            case 3: // South
                pos = [x, y, z, x + w, y, z, x + w, y - h, z, x, y - h, z]
                break
            case 4: // East
                pos = [x, y, z, x, y, z + w, x, y - h, z + w, x, y - h, z]
                break
            case 5: // West
                pos = [x, y, z, x, y, z - w, x, y - h, z - w, x, y - h, z]
                break
        }

        pos = pos.map(c => c / 16 - 0.5)
        let minmax = compareArr(pos, [])
        pos.max = minmax.splice(3, 3)
        pos.min = minmax
        tex = tex.map(c => c / 16 / 16)

        return {
            pos: pos,
            tex: tex
        }
    }

    // 90 degree clockwise rotation; returns a new shape object
    function rotate(shape) {
        let verts = shape.verts
        let texVerts = shape.texVerts
        let cull = shape.cull
        let pos = []
        tex = []
        for (let i = 0; i < verts.length; i++) {
            let side = verts[i]
            pos[i] = []
            tex[i] = []
            for (let j = 0; j < side.length; j++) {
                let face = side[j]
                let c = []
                pos[i][j] = c
                for (let k = 0; k < face.length; k += 3) {
                    c[k] = face[k + 2]
                    c[k + 1] = face[k + 1]
                    c[k + 2] = -face[k]
                }

                tex[i][j] = texVerts[i][j].slice() // Copy texture verts exactly
                if (!i) {
                    // Bottom
                    c.push(...c.splice(0, 3))
                    tex[i][j].push(...tex[i][j].splice(0, 2))
                }
                if (i) {
                    // Top
                    c.unshift(...c.splice(-3, 3))
                    tex[i][j].unshift(...tex[i][j].splice(-2, 2))
                }

                let minmax = compareArr(c, [])
                c.max = minmax.splice(3, 3)
                c.min = minmax
            }
        }
        let temp = tex[2] // North
        tex[2] = tex[5] // North = West
        tex[5] = tex[3] // West = South
        tex[3] = tex[4] // South = East
        tex[4] = temp // East = North

        temp = pos[2] // North
        pos[2] = pos[5] // North = West
        pos[5] = pos[3] // West = South
        pos[3] = pos[4] // South = East
        pos[4] = temp // East = North

        let cull2 = {
            top: cull.top,
            bottom: cull.bottom,
            north: cull.west,
            west: cull.south,
            south: cull.east,
            east: cull.north
        }

        let buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos.flat(2)), gl.STATIC_DRAW)

        return {
            verts: pos,
            texVerts: tex,
            cull: cull2,
            rotate: true,
            flip: shape.flip,
            buffer: buffer,
            size: shape.size,
            varients: shape.varients
        }
    }

    // Reflect over the y plane; returns a new shape object
    function flip(shape) {
        let verts = shape.verts
        let texVerts = shape.texVerts
        let cull = shape.cull
        let pos = []
        tex = []
        for (let i = 0; i < verts.length; i++) {
            let side = verts[i]
            pos[i] = []
            tex[i] = []
            for (let j = 0; j < side.length; j++) {
                let face = side[j].slice().reverse()
                let c = []
                pos[i][j] = c
                for (let k = 0; k < face.length; k += 3) {
                    c[k] = face[k + 2]
                    c[k + 1] = -face[k + 1]
                    c[k + 2] = face[k]
                }
                let minmax = compareArr(c, [])
                c.max = minmax.splice(3, 3)
                c.min = minmax

                tex[i][j] = texVerts[i][j].slice() // Copy texture verts exactly
            }
        }
        let temp = pos[0] // Bottom
        pos[0] = pos[1] // Bottom = Top
        pos[1] = temp // Top = Bottom

        temp = tex[0] // Bottom
        tex[0] = tex[1] // Bottom = Top
        tex[1] = temp // Top = Bottom

        let cull2 = {
            top: cull.bottom,
            bottom: cull.top,
            north: (cull.north & 1) << 1 | (cull.north & 2) >> 1,
            west: (cull.west & 1) << 1 | (cull.west & 2) >> 1,
            south: (cull.south & 1) << 1 | (cull.south & 2) >> 1,
            east: (cull.east & 1) << 1 | (cull.east & 2) >> 1
        }

        let buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos.flat(2)), gl.STATIC_DRAW)

        return {
            verts: pos,
            texVerts: tex,
            cull: cull2,
            rotate: shape.rotate,
            flip: shape.flip,
            buffer: buffer,
            size: shape.size,
            varients: shape.varients
        }
    }

    for (let shape in shapes) {
        let obj = shapes[shape]
        let verts = obj.verts

        // Populate the vertex coordinates
        for (let i = 0; i < verts.length; i++) {
            let side = verts[i]
            let texArr = []
            obj.texVerts.push(texArr)
            for (let j = 0; j < side.length; j++) {
                let face = side[j]
                let mapped = mapCoords(face, i)
                side[j] = mapped.pos
                texArr.push(mapped.tex)
            }
        }

        if (obj.rotate) {
            let v = obj.varients
            let east = rotate(obj)
            let south = rotate(east)
            let west = rotate(south)
            v[0] = obj
            v[2] = south
            v[4] = east
            v[6] = west
        }

        if (obj.flip) {
            let v = obj.varients
            v[1] = flip(obj)
            if (obj.rotate) {
                v[3] = flip(v[2])
                v[5] = flip(v[4])
                v[7] = flip(v[6])
            }
        }

        obj.buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts.flat(2)), gl.STATIC_DRAW)
    }

    for (let i = 0; i < BLOCK_COUNT; i++) {
        let baseBlock = blockData[i]
        let slabBlock = Object.create(baseBlock)
        let stairBlock = Object.create(baseBlock)
        slabBlock.shape = shapes.slab
        baseBlock.shape = shapes.cube
        stairBlock.shape = shapes.stair
        blockData[i | SLAB] = slabBlock
        blockData[i | STAIR] = stairBlock
        let v = slabBlock.shape.varients
        for (let j = 0; j < v.length; j++) {
            if (v[j]) {
                let block = Object.create(baseBlock)
                block.shape = v[j]
                blockData[i | SLAB | j << 10] = block
            }
        }
        v = stairBlock.shape.varients
        for (let j = 0; j < v.length; j++) {
            if (v[j]) {
                let block = Object.create(baseBlock)
                block.shape = v[j]
                blockData[i | STAIR | j << 10] = block
            }
        }
    }
}

let indexOrder;
(function() {
    let arr = []
    for (let i = 0; i < 100000; i++) {
        arr.push(0 + i * 4, 1 + i * 4, 2 + i * 4, 0 + i * 4, 2 + i * 4, 3 + i * 4)
    }
    indexOrder = new Uint32Array(arr)
})()

let hexagonVerts
let slabIconVerts
let stairIconVerts
let blockIcons

{
    const side = Math.sqrt(3) / 2
    const s = side
    const q = s / 2;
    hexagonVerts = new Float32Array([
        0, 1, 1, side, 0.5, 1, 0, 0, 1, -side, 0.5, 1,
        0, 0, 1, side, 0.5, 1, side, -0.5, 1, 0, -1, 1,
        -side, 0.5, 1, 0, 0, 1, 0, -1, 1, -side, -0.5, 1,
    ])

    slabIconVerts = new Float32Array([
        0, 0.5, 1, side, 0, 1, 0, -0.5, 1, -side, 0, 1,
        0, -0.5, 1, side, 0, 1, side, -0.5, 1, 0, -1, 1,
        -side, 0, 1, 0, -0.5, 1, 0, -1, 1, -side, -0.5, 1,
    ])

    stairIconVerts = [
        -s, 0.5, 0, 0, 1, 0, 1, 1, 0, 1, q, 0.75, 1, 0.5, 1, -q, 0.25, 0, 0.5, 1, // top of the top step
        -q, -0.25, 0, 0, 1, q, 0.25, 1, 0, 1, s, 0, 1, 0.5, 1, 0, -0.5, 0, 0.5, 1, // top of the bottom step
        -q, 0.25, 0, 0, 0.6, q, 0.75, 1, 0, 0.6, q, 0.25, 1, 0.5, 0.6, -q, -0.25, 0, 0.5, 0.6, // front of the top step
        0, -0.5, 0, 0, 0.6, s, 0, 1, 0, 0.6, s, -0.5, 1, 0.5, 0.6, 0, -1, 0, 0.5, 0.6, // front of the bottom step
        -s, 0.5, 0, 0, 0.8, -q, 0.25, 0.5, 0, 0.8, -q, -0.75, 0.5, 1, 0.8, -s, -0.5, 0, 1, 0.8, // side of the top step
        -q, -0.25, 0.5, 0.5, 0.8, 0, -0.5, 1, 0.5, 0.8, 0, -1, 1, 1, 0.8, -q, -0.75, 0.5, 1, 0.8, // side of the bottom step
    ]
} // Shapes

function genIcons() {
    blockIcons = [null]
    blockIcons.lengths = []
    let texOrder = [1, 2, 3]
    let shadows = [1, 0.4, 0.7]
    let scale = 0.16 / height * inventory.size;
    for (let i = 1; i < BLOCK_COUNT; i++) {
        let data = []
        let block = blockData[i]
        for (let j = 11; j >= 0; j--) {
            data.push(-hexagonVerts[j * 3 + 0] * scale)
            data.push(hexagonVerts[j * 3 + 1] * scale)
            data.push(0.1666666)
            data.push(textureCoords[textureMap[block.textures[texOrder[Math.floor(j / 4)]]]][(j * 2 + 0) % 8])
            data.push(textureCoords[textureMap[block.textures[texOrder[Math.floor(j / 4)]]]][(j * 2 + 1) % 8])
            data.push(shadows[Math.floor(j / 4)])
        }
        let buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
        blockIcons[i] = buffer
        blockIcons.lengths[i] = 6 * 3

        data = []
        for (let j = 11; j >= 0; j--) {
            let tex = textureCoords[textureMap[block.textures[texOrder[Math.floor(j / 4)]]]]

            data.push(-slabIconVerts[j * 3 + 0] * scale)
            data.push(slabIconVerts[j * 3 + 1] * scale)
            data.push(0.1666666)
            data.push(tex[(j * 2 + 0) % 8])
            data.push(tex[(j * 2 + 1) % 8])
            data.push(shadows[Math.floor(j / 4)])
        }
        buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
        blockIcons[i | SLAB] = buffer
        blockIcons.lengths[i | SLAB] = 6 * 3

        data = []
        let v = stairIconVerts
        for (let j = 23; j >= 0; j--) {
            let num = Math.floor(j / 8)
            let tex = textureCoords[textureMap[block.textures[texOrder[num]]]]
            let tx = tex[0]
            let ty = tex[1]
            data.push(-v[j * 5 + 0] * scale)
            data.push(v[j * 5 + 1] * scale)
            data.push(0.1666666)
            data.push(tx + v[j * 5 + 2] / 16)
            data.push(ty + v[j * 5 + 3] / 16)
            data.push(shadows[num])
        }
        buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
        blockIcons[i | STAIR] = buffer
        blockIcons.lengths[i | STAIR] = 6 * 6
    }
}

function uniformMatrix(cacheId, programObj, vrName, transpose, matrix) {
    let vrLocation = glUniforms[cacheId]
    if (vrLocation === undefined) {
        vrLocation = gl.getUniformLocation(programObj, vrName)
        glUniforms[cacheId] = vrLocation
    }
    gl.uniformMatrix4fv(vrLocation, transpose, matrix)
}

function vertexAttribPointer(cacheId, programObj, vrName, size, VBO) {
    let vrLocation = glUniforms[cacheId]
    if (vrLocation === undefined) {
        vrLocation = gl.getAttribLocation(programObj, vrName)
        glUniforms[cacheId] = vrLocation
    }
    if (vrLocation !== -1) {
        gl.enableVertexAttribArray(vrLocation)
        gl.bindBuffer(gl.ARRAY_BUFFER, VBO)
        gl.vertexAttribPointer(vrLocation, size, gl.FLOAT, false, 0, 0)

    }
}

//Generate buffers for every block face and store them
let sideEdgeBuffers
let indexBuffer

function cross(v1, v2, result) {
    let x = v1.x,
        y = v1.y,
        z = v1.z,
        x2 = v2.x,
        y2 = v2.y,
        z2 = v2.z
    result.x = y * z2 - y2 * z
    result.y = z * x2 - z2 * x
    result.z = x * y2 - x2 * y
}

let matrix = new Float32Array(16); // A temperary matrix that may store random data.
let projection = new Float32Array(16)
let defaultModelView = new Float32Array([-10, 0, 0, 0, 0, 10, 0, 0, 0, 0, -10, 0, 0, 0, 0, 1])
class Matrix {
    constructor(arr) {
        this.elements = new Float32Array(arr || 16)
    }
    translate(x, y, z) {
        let a = this.elements
        a[3] += a[0] * x + a[1] * y + a[2] * z
        a[7] += a[4] * x + a[5] * y + a[6] * z
        a[11] += a[8] * x + a[9] * y + a[10] * z
        a[15] += a[12] * x + a[13] * y + a[14] * z
    }
    rotX(angle) {
        let elems = this.elements
        let c = Math.cos(angle)
        let s = Math.sin(angle)
        let t = elems[1]
        elems[1] = t * c + elems[2] * s
        elems[2] = t * -s + elems[2] * c
        t = elems[5]
        elems[5] = t * c + elems[6] * s
        elems[6] = t * -s + elems[6] * c
        t = elems[9]
        elems[9] = t * c + elems[10] * s
        elems[10] = t * -s + elems[10] * c
        t = elems[13]
        elems[13] = t * c + elems[14] * s
        elems[14] = t * -s + elems[14] * c
    }
    rotY(angle) {
        let c = Math.cos(angle)
        let s = Math.sin(angle)
        let elems = this.elements
        let t = elems[0]
        elems[0] = t * c + elems[2] * -s
        elems[2] = t * s + elems[2] * c
        t = elems[4]
        elems[4] = t * c + elems[6] * -s
        elems[6] = t * s + elems[6] * c
        t = elems[8]
        elems[8] = t * c + elems[10] * -s
        elems[10] = t * s + elems[10] * c
        t = elems[12]
        elems[12] = t * c + elems[14] * -s
        elems[14] = t * s + elems[14] * c
    }
    transpose() {
        let matrix = this.elements
        let temp = matrix[4]
        matrix[4] = matrix[1]
        matrix[1] = temp

        temp = matrix[8]
        matrix[8] = matrix[2]
        matrix[2] = temp

        temp = matrix[6]
        matrix[6] = matrix[9]
        matrix[9] = temp

        temp = matrix[3]
        matrix[3] = matrix[12]
        matrix[12] = temp

        temp = matrix[7]
        matrix[7] = matrix[13]
        matrix[13] = temp

        temp = matrix[11]
        matrix[11] = matrix[14]
        matrix[14] = temp
    }
    copyArray(from) {
        let to = this.elements
        for (let i = 0; i < from.length; i++) {
            to[i] = from[i]
        }
    }
    copyMatrix(from) {
        let to = this.elements
        from = from.elements
        for (let i = 0; i < from.length; i++) {
            to[i] = from[i]
        }
    }
}

class Plane {
    constructor(nx, ny, nz) {
        this.set(nx, ny, nz)
    }
    set(nx, ny, nz) {
        // Pre-computed chunk offsets to reduce branching during culling
        this.dx = nx > 0 ? 16 : 0
        this.dy = ny > 0
        this.dz = nz > 0 ? 16 : 0

        // Normal vector for the plane
        this.nx = nx
        this.ny = ny
        this.nz = nz
    }
}

let defaultTransformation = new Matrix([-10, 0, 0, 0, 0, 10, 0, 0, 0, 0, -10, 0, 0, 0, 0, 1])
class Camera {
    constructor() {
        this.x = 0
        this.y = 0
        this.z = 0
        this.rx = 0; // Pitch
        this.ry = 0; // Yaw
        this.currentFov = 0
        this.defaultFov = settings.fov
        this.targetFov = settings.fov
        this.step = 0
        this.lastStep = 0
        this.projection = new Float32Array(5)
        this.transformation = new Matrix()
        this.direction = {
            x: 1,
            y: 0,
            z: 0
        }; // Normalized direction vector
        this.frustum = [] // The 5 planes of the viewing frustum (there's no far plane)
        for (let i = 0; i < 5; i++) {
            this.frustum.push(new Plane(1, 0, 0))
        }
    }
    FOV(fov, time) {
        if (fov === this.currentFov) return

        if (!fov) {
            let now = Date.now()
            fov = this.currentFov + this.step * (now - this.lastStep)
            this.lastStep = now
            if (Math.sign(this.targetFov - this.currentFov) !== Math.sign(this.targetFov - fov)) {
                fov = this.targetFov
            }
        } else if (time) {
            this.targetFov = fov
            this.step = (fov - this.currentFov) / time
            this.lastStep = Date.now()
            return
        } else {
            this.targetFov = fov
        }

        const tang = Math.tan(fov * Math.PI / 360)
        const scale = 1 / tang
        const near = 1
        const far = 1000000
        this.currentFov = fov; // Store the state of the projection matrix
        this.nearH = near * tang; // This is needed for frustum culling

        this.projection[0] = scale / width * height
        this.projection[1] = scale
        this.projection[2] = -far / (far - near)
        this.projection[3] = -1
        this.projection[4] = -far * near / (far - near)
    }
    transform() {
        this.transformation.copyMatrix(defaultTransformation)
        this.transformation.rotX(this.rx)
        this.transformation.rotY(this.ry)
        this.transformation.translate(-this.x, -this.y, -this.z)
    }
    getMatrix() {
        let proj = this.projection
        let view = this.transformation.elements
        matrix[0] = proj[0] * view[0]
        matrix[1] = proj[1] * view[4]
        matrix[2] = proj[2] * view[8] + proj[3] * view[12]
        matrix[3] = proj[4] * view[8]
        matrix[4] = proj[0] * view[1]
        matrix[5] = proj[1] * view[5]
        matrix[6] = proj[2] * view[9] + proj[3] * view[13]
        matrix[7] = proj[4] * view[9]
        matrix[8] = proj[0] * view[2]
        matrix[9] = proj[1] * view[6]
        matrix[10] = proj[2] * view[10] + proj[3] * view[14]
        matrix[11] = proj[4] * view[10]
        matrix[12] = proj[0] * view[3]
        matrix[13] = proj[1] * view[7]
        matrix[14] = proj[2] * view[11] + proj[3] * view[15]
        matrix[15] = proj[4] * view[11]
        return matrix
    }
    setDirection() {
        if (this.targetFov !== this.currentFov) {
            this.FOV()
        }
        this.direction.x = -Math.sin(this.ry) * Math.cos(this.rx)
        this.direction.y = Math.sin(this.rx)
        this.direction.z = Math.cos(this.ry) * Math.cos(this.rx)
        this.computeFrustum()
    }
    computeFrustum() {
        let X = vec1
        let dir = this.direction
        X.x = dir.z
        X.y = 0
        X.z = -dir.x
        X.normalize()

        let Y = vec2
        Y.set(dir)
        Y.mult(-1)
        cross(Y, X, Y)

        //Near plane
        this.frustum[0].set(dir.x, dir.y, dir.z)

        let aux = vec3
        aux.set(Y)
        aux.mult(this.nearH)
        aux.add(dir)
        aux.normalize()
        cross(aux, X, aux)
        this.frustum[1].set(aux.x, aux.y, aux.z)

        aux.set(Y)
        aux.mult(-this.nearH)
        aux.add(dir)
        aux.normalize()
        cross(X, aux, aux)
        this.frustum[2].set(aux.x, aux.y, aux.z)

        aux.set(X)
        aux.mult(-this.nearH * width / height)
        aux.add(dir)
        aux.normalize()
        cross(aux, Y, aux)
        this.frustum[3].set(aux.x, aux.y, aux.z)

        aux.set(X)
        aux.mult(this.nearH * width / height)
        aux.add(dir)
        aux.normalize()
        cross(Y, aux, aux)
        this.frustum[4].set(aux.x, aux.y, aux.z)
    } // This probably manages frustrum culling
    canSee(x, y, z, maxY) {
        x -= 0.5
        y -= 0.5
        z -= 0.5
        maxY += 0.5
        let px = 0,
            py = 0,
            pz = 0,
            plane = null
        let cx = p.x,
            cy = p.y,
            cz = p.z
        for (let i = 0; i < 5; i++) {
            plane = this.frustum[i]
            px = x + plane.dx
            py = plane.dy ? maxY : y
            pz = z + plane.dz
            if ((px - cx) * plane.nx + (py - cy) * plane.ny + (pz - cz) * plane.nz < 0) {
                return false
            }
        }
        return true
    } // Frustrum Culling?
}

function trans(matrix, x, y, z) {
    let a = matrix
    a[3] += a[0] * x + a[1] * y + a[2] * z
    a[7] += a[4] * x + a[5] * y + a[6] * z
    a[11] += a[8] * x + a[9] * y + a[10] * z
    a[15] += a[12] * x + a[13] * y + a[14] * z
}

function rotX(matrix, angle) {
    // This function is basically multiplying 2 4x4 matrices together,
    // but 1 of them has a bunch of 0's and 1's in it,
    // so I removed all terms that multiplied by 0, and just left off the 1's.
    // mat2 = [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]
    let elems = matrix
    let c = Math.cos(angle)
    let s = Math.sin(angle)
    let t = elems[1]
    elems[1] = t * c + elems[2] * s
    elems[2] = t * -s + elems[2] * c
    t = elems[5]
    elems[5] = t * c + elems[6] * s
    elems[6] = t * -s + elems[6] * c
    t = elems[9]
    elems[9] = t * c + elems[10] * s
    elems[10] = t * -s + elems[10] * c
    t = elems[13]
    elems[13] = t * c + elems[14] * s
    elems[14] = t * -s + elems[14] * c
}

function rotY(matrix, angle) {
    //source = c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1
    let c = Math.cos(angle)
    let s = Math.sin(angle)
    let elems = matrix
    let t = elems[0]
    elems[0] = t * c + elems[2] * -s
    elems[2] = t * s + elems[2] * c
    t = elems[4]
    elems[4] = t * c + elems[6] * -s
    elems[6] = t * s + elems[6] * c
    t = elems[8]
    elems[8] = t * c + elems[10] * -s
    elems[10] = t * s + elems[10] * c
    t = elems[12]
    elems[12] = t * c + elems[14] * -s
    elems[14] = t * s + elems[14] * c
}

function transpose(matrix) {
    let temp = matrix[4]
    matrix[4] = matrix[1]
    matrix[1] = temp

    temp = matrix[8]
    matrix[8] = matrix[2]
    matrix[2] = temp

    temp = matrix[6]
    matrix[6] = matrix[9]
    matrix[9] = temp

    temp = matrix[3]
    matrix[3] = matrix[12]
    matrix[12] = temp

    temp = matrix[7]
    matrix[7] = matrix[13]
    matrix[13] = temp

    temp = matrix[11]
    matrix[11] = matrix[14]
    matrix[14] = temp
}

function matMult() {
    //Multiply the projection matrix by the view matrix; this is optimized specifically for these matrices by removing terms that are always 0.
    let proj = projection
    let view = modelView
    matrix[0] = proj[0] * view[0]
    matrix[1] = proj[0] * view[1]
    matrix[2] = proj[0] * view[2]
    matrix[3] = proj[0] * view[3]
    matrix[4] = proj[5] * view[4]
    matrix[5] = proj[5] * view[5]
    matrix[6] = proj[5] * view[6]
    matrix[7] = proj[5] * view[7]
    matrix[8] = proj[10] * view[8] + proj[11] * view[12]
    matrix[9] = proj[10] * view[9] + proj[11] * view[13]
    matrix[10] = proj[10] * view[10] + proj[11] * view[14]
    matrix[11] = proj[10] * view[11] + proj[11] * view[15]
    matrix[12] = proj[14] * view[8]
    matrix[13] = proj[14] * view[9]
    matrix[14] = proj[14] * view[10]
    matrix[15] = proj[14] * view[11]
}

function copyArr(a, b) {
    for (let i = 0; i < a.length; i++) {
        b[i] = a[i]
    }
}

function FOV(fov) {
    let tang = Math.tan(fov * 0.5 * Math.PI / 180)
    let scale = 1 / tang
    let near = 1
    let far = 1000000
    currentFov = fov

    projection[0] = scale / width * height
    projection[5] = scale
    projection[10] = -far / (far - near)
    projection[11] = -1
    projection[14] = -far * near / (far - near)
}

function initModelView(camera, x, y, z, rx, ry) {
    if (camera) {
        camera.transform()
        uniformMatrix("view3d", programs[0], "uView", false, camera.getMatrix())
    } else {
        copyArr(defaultModelView, modelView)
        rotX(modelView, rx)
        rotY(modelView, ry)
        trans(modelView, -x, -y, -z)
        matMult()
        transpose(matrix)
        uniformMatrix("view3d", programs[0], "uView", false, matrix)
    }
}

function timeString(millis) {
    if (millis > 300000000000 || !millis) {
        return "never"
    }

    const SECOND = 1000
    const MINUTE = SECOND * 60
    const HOUR = MINUTE * 60
    const DAY = HOUR * 24
    const YEAR = DAY * 365

    if (millis < MINUTE) {
        return "just now"
    }

    let years = Math.floor(millis / YEAR)
    millis -= years * YEAR

    let days = Math.floor(millis / DAY)
    millis -= days * DAY

    let hours = Math.floor(millis / HOUR)
    millis -= hours * HOUR

    let minutes = Math.floor(millis / MINUTE)

    if (years) {
        return `${years} year${years > 1 ? "s" : ""} and ${days} day${day !== 1 ? "s" : ""} ago`
    }
    if (days) {
        return `${days} day${days > 1 ? "s" : ""} and ${hours} hour${hours !== 1 ? "s" : ""} ago`
    }
    if (hours) {
        return `${hours} hour${hours > 1 ? "s" : ""} and ${minutes} minute${minutes !== 1 ? "s" : ""} ago`
    }
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
}

function roundBits(number) {
    return Math.round(number * 1000000) / 1000000
}

function rayTrace(x, y, z, shape) {
    let cf, cd = 1e9; //Closest face and distance
    let m; //Absolute distance to intersection point
    let ix, iy, iz; //Intersection coords
    let minX, miny, minz, maxX, maxY, maxZ, min, max; //Bounds of face coordinates
    let east = p.direction.x < 0
    let top = p.direction.y < 0
    let north = p.direction.z < 0
    let verts = shape.verts
    let faces = verts[0]

    //Top and bottom faces

    if (top) {
        faces = verts[1]
    }
    if (p.direction.y) {
        for (let face of faces) {
            min = face.min
            minX = min[0]
            minZ = min[2]
            max = face.max
            maxX = max[0]
            maxZ = max[2]
            m = (y + face[1] - p.y) / p.direction.y
            ix = m * p.direction.x + p.x
            iz = m * p.direction.z + p.z
            if (m > 0 && m < cd && ix >= x + minX && ix <= x + maxX && iz >= z + minZ && iz <= z + maxZ) {
                cd = m; //Ray crosses bottom face
                cf = top ? "top" : "bottom"
            }
        }
    }

    //West and East faces
    if (east) {
        faces = verts[4]
    } else {
        faces = verts[5]
    }
    if (p.direction.x) {
        for (let face of faces) {
            min = face.min
            minY = min[1]
            minZ = min[2]
            max = face.max
            maxY = max[1]
            maxZ = max[2]
            m = (x + face[0] - p.x) / p.direction.x
            iy = m * p.direction.y + p.y
            iz = m * p.direction.z + p.z
            if (m > 0 && m < cd && iy >= y + minY && iy <= y + maxY && iz >= z + minZ && iz <= z + maxZ) {
                cd = m
                cf = east ? "east" : "west"
            }
        }
    }

    //South and North faces
    if (north) {
        faces = verts[2]
    } else {
        faces = verts[3]
    }
    if (p.direction.z) {
        for (let face of faces) {
            min = face.min
            minX = min[0]
            minY = min[1]
            max = face.max
            maxX = max[0]
            maxY = max[1]
            m = (z + face[2] - p.z) / p.direction.z
            ix = m * p.direction.x + p.x
            iy = m * p.direction.y + p.y
            if (m > 0 && m < cd && ix >= x + minX && ix <= x + maxX && iy >= y + minY && iy <= y + maxY) {
                cd = m
                cf = north ? "north" : "south"
            }
        }
    }
    return [cd, cf]
}

function runRayTrace(x, y, z) {
    let block = world.getBlock(x, y, z)
    if (block) {
        let shape = blockData[block].shape
        let rt = rayTrace(x, y, z, blockData[block].shape)

        if (rt[1] && rt[0] < hitBox.closest) {
            hitBox.closest = rt[0]
            hitBox.face = rt[1]
            hitBox.pos = [x, y, z]
            hitBox.shape = blockData[block].shape
        }
    }
}

function lookingAt() {
    // Checks blocks in front of the player to see which one they're looking at
    hitBox.pos = null
    hitBox.closest = 1e9

    if (p.spectator) {
        return
    }
    let blockState = world.getBlock(p2.x, p2.y, p2.z)
    if (blockState) {
        hitBox.pos = [p2.x, p2.y, p2.z]
        hitBox.closest = 0
        hitBox.shape = blockData[blockState].shape
        return
    }

    let pd = p.direction

    // Target block
    let tx = Math.round(pd.x * reach + p.x)
    let ty = Math.round(pd.y * reach + p.y)
    let tz = Math.round(pd.z * reach + p.z)

    let minX = p2.x
    let maxX = 0
    let minY = p2.y
    let maxY = 0
    let minZ = p2.z
    let maxZ = 0

    for (let i = 0; i < reach + 1; i++) {
        if (i > reach) {
            i = reach
        }
        maxX = Math.round(p.x + pd.x * i)
        maxY = Math.round(p.y + pd.y * i)
        maxZ = Math.round(p.z + pd.z * i)
        if (maxX === minX && maxY === minY && maxZ === minZ) {
            continue
        }
        if (minX !== maxX) {
            if (minY !== maxY) {
                if (minZ !== maxZ) {
                    runRayTrace(maxX, maxY, maxZ)
                }
                runRayTrace(maxX, maxY, minZ)
            }
            if (minZ !== maxZ) {
                runRayTrace(maxX, minY, maxZ)
            }
            runRayTrace(maxX, minY, minZ)
        }
        if (minY !== maxY) {
            if (minZ !== maxZ) {
                runRayTrace(minX, maxY, maxZ)
            }
            runRayTrace(minX, maxY, minZ)
        }
        if (minZ !== maxZ) {
            runRayTrace(minX, minY, maxZ)
        }
        if (hitBox.pos) {
            return; //The ray has collided; it can't possibly find a closer collision now
        }
        minZ = maxZ
        minY = maxY
        minX = maxX
    }
}
let inBox = function(x, y, z, w, h, d) {
    let iy = y - h / 2 - p.topH
    let ih = h + p.bottomH + p.topH
    let ix = x - w / 2 - p.w
    let iw = w + p.w * 2
    let iz = z - d / 2 - p.w
    let id = d + p.w * 2
    return p.x > ix && p.y > iy && p.z > iz && p.x < ix + iw && p.y < iy + ih && p.z < iz + id
}
let onBox = function(x, y, z, w, h, d) {
    let iy = roundBits(y - h / 2 - p.topH)
    let ih = roundBits(h + p.bottomH + p.topH)
    let ix = roundBits(x - w / 2 - p.w)
    let iw = roundBits(w + p.w * 2)
    let iz = roundBits(z - d / 2 - p.w)
    let id = roundBits(d + p.w * 2)
    return p.x > ix && p.y > iy && p.z > iz && p.x < ix + iw && p.y <= iy + ih && p.z < iz + id
}

function collided(x, y, z, vx, vy, vz, block) {
    if (p.spectator) {
        return false
    }
    let verts = blockData[block].shape.verts
    let px = roundBits(p.x - p.w - x)
    let py = roundBits(p.y - p.bottomH - y)
    let pz = roundBits(p.z - p.w - z)
    let pxx = roundBits(p.x + p.w - x)
    let pyy = roundBits(p.y + p.topH - y)
    let pzz = roundBits(p.z + p.w - z)
    let minX, minY, minZ, maxX, maxY, maxZ, min, max

    //Top and bottom faces
    let faces = verts[0]
    if (vy <= 0) {
        faces = verts[1]
    }
    if (!vx && !vz) {
        for (let face of faces) {
            min = face.min
            minX = min[0]
            minZ = min[2]
            max = face.max
            maxX = max[0]
            maxZ = max[2]
            if (face[1] > py && face[1] < pyy && minX < pxx && maxX > px && minZ < pzz && maxZ > pz) {
                if (vy <= 0) {
                    p.onGround = true
                    p.y = Math.round((face[1] + y + p.bottomH) * 10000) / 10000
                    return false
                } else {
                    return true
                }
            }
        }
        return false
    }

    //West and East faces
    if (vx < 0) {
        faces = verts[4]
    } else if (vx > 0) {
        faces = verts[5]
    }
    if (vx) {
        let col = false
        for (let face of faces) {
            min = face.min
            minZ = min[2]
            minY = min[1]
            max = face.max
            maxZ = max[2]
            maxY = max[1]
            if (face[0] > px && face[0] < pxx && minY < pyy && maxY > py && minZ < pzz && maxZ > pz) {
                if (maxY - py > 0.5) {
                    p.canStepX = false
                }
                col = true
            }
        }
        return col
    }

    //South and North faces
    if (vz < 0) {
        faces = verts[2]
    } else if (vz > 0) {
        faces = verts[3]
    }
    if (vz) {
        let col = false
        for (let face of faces) {
            min = face.min
            minX = min[0]
            minY = min[1]
            max = face.max
            maxX = max[0]
            maxY = max[1]
            if (face[2] > pz && face[2] < pzz && minY < pyy && maxY > py && minX < pxx && maxX > px) {
                if (maxY - py > 0.5) {
                    p.canStepZ = false
                }
                col = true
            }
        }
        return col
    }
}
let contacts = {
    array: [],
    size: 0,
    add: function(x, y, z, block) {
        if (this.size === this.array.length) {
            this.array.push([x, y, z, block])
        } else {
            this.array[this.size][0] = x
            this.array[this.size][1] = y
            this.array[this.size][2] = z
            this.array[this.size][3] = block
        }
        this.size++
    },
    clear: function() {
        this.size = 0
    },
}
let resolveContactsAndUpdatePosition = function() {
    let pminX = p2.x - 1
    let pmaxX = p2.x + 1
    let pminY = p2.y - 2
    let pmaxY = p2.y + 1
    let pminZ = p2.z - 1
    let pmaxZ = p2.z + 1
    let block = null
    let vel = p.velocity

    for (let x = pminX; x <= pmaxX; x++) {
        for (let y = pminY; y <= pmaxY; y++) {
            for (let z = pminZ; z <= pmaxZ; z++) {
                let block = world.getBlock(x, y, z)
                if (block) {
                    contacts.add(x, y, z, block)
                }
            }
        }
    }

    let dt = (win.performance.now() - p.lastUpdate) / 33
    dt = dt > 2 ? 2 : dt

    p.previousX = p.x
    p.previousY = p.y
    p.previousZ = p.z

    //Check collisions in the Y direction
    p.onGround = false
    p.canStepX = false
    p.canStepZ = false
    p.y += vel.y * dt
    for (let i = 0; i < contacts.size; i++) {
        block = contacts.array[i]
        if (collided(block[0], block[1], block[2], 0, vel.y, 0, block[3])) {
            p.y = p.previousY
            vel.y = 0
            break
        }
    }
    if (p.y === p.previousY && !p.flying) {
        p.canStepX = true
        p.canStepZ = true
    }

    let sneakLock = false,
        sneakSafe = false
    if (p.sneaking) {
        for (let i = 0; i < contacts.size; i++) {
            block = contacts.array[i]
            if (onBox(block[0], block[1], block[2], 1, 1, 1)) {
                sneakLock = true
                break
            }
        }
    }

    //Check collisions in the X direction
    p.x += vel.x * dt
    for (let i = 0; i < contacts.size; i++) {
        block = contacts.array[i]
        if (collided(block[0], block[1], block[2], vel.x, 0, 0, block[3])) {
            if (p.canStepX && !world.getBlock(block[0], block[1] + 1, block[2]) && !world.getBlock(block[0], block[1] + 2, block[2])) {
                continue
            }
            p.x = p.previousX
            vel.x = 0
            break
        }
        if (sneakLock && onBox(block[0], block[1], block[2], 1, 1, 1)) {
            sneakSafe = true
        }
    }

    if (sneakLock && !sneakSafe) {
        p.x = p.previousX
        vel.x = 0
    }
    sneakSafe = false

    //Check collisions in the Z direction
    p.z += vel.z * dt
    for (let i = 0; i < contacts.size; i++) {
        block = contacts.array[i]
        if (collided(block[0], block[1], block[2], 0, 0, vel.z, block[3])) {
            if (p.canStepZ && !world.getBlock(block[0], block[1] + 1, block[2]) && !world.getBlock(block[0], block[1] + 2, block[2])) {
                continue
            }
            p.z = p.previousZ
            vel.z = 0
            break
        }
        if (sneakLock && onBox(block[0], block[1], block[2], 1, 1, 1)) {
            sneakSafe = true
        }
    }

    if (sneakLock && !sneakSafe) {
        p.z = p.previousZ
        vel.z = 0
    }

    if (!p.flying) {
        let drag = p.onGround ? 0.5 : 0.85
        p.velocity.z += (p.velocity.z * drag - p.velocity.z) * dt
        p.velocity.x += (p.velocity.x * drag - p.velocity.x) * dt
    } else {
        let drag = 0.9
        p.velocity.z += (p.velocity.z * drag - p.velocity.z) * dt
        p.velocity.x += (p.velocity.x * drag - p.velocity.x) * dt
        p.velocity.y += (p.velocity.y * 0.8 - p.velocity.y) * dt
        if (p.onGround && !p.spectator) {
            p.flying = false
        }
    }

    p.lastUpdate = win.performance.now()
    contacts.clear()
    lookingAt()
}
let runGravity = function() {
    if (p.flying) {
        return
    }
    let dt = (win.performance.now() - p.lastUpdate) / 33
    dt = dt > 2 ? 2 : dt
    if (p.onGround) {
        if (Key[" "]) {
            p.velocity.y = p.jumpSpeed
            p.onGround = false
        } else {
            p.velocity.y = 0
        }
    } else {
        p.velocity.y += p.gravityStength * dt
        if (p.velocity.y < -p.maxYVelocity) {
            p.velocity.y = -p.maxYVelocity
        }
    }
}

function box2(sides, tex) {
    if (blockFill) {
        let i = 0
        for (let side in Block) {
            if (sides & Block[side]) {
                vertexAttribPointer("aVertex", programs[0], "aVertex", 3, sideEdgeBuffers[Sides[side]])
                vertexAttribPointer("aTexture", programs[0], "aTexture", 2, texCoordsBuffers[textureMap[tex[i]]])
                gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0)
            }
            i++
        }
    }
    if (blockOutlines) {
        vertexAttribPointer("aVertex", programs[0], "aVertex", 3, hitBox.shape.buffer)
        vertexAttribPointer("aTexture", programs[0], "aTexture", 2, texCoordsBuffers[textureMap.hitbox])
        for (let i = 0; i < hitBox.shape.size; i++) {
            gl.drawArrays(gl.LINE_LOOP, i * 4, 4)
        }
    }
}

function block2(x, y, z, t, camera) {
    if (camera) {
        camera.transformation.translate(x, y, z)
        uniformMatrix("view3d", programs[0], "uView", false, camera.getMatrix())
    } else {
        //copyArr(modelView, matrix)
        trans(modelView, x, y, z)
        matMult()
        trans(modelView, -x, -y, -z)
        transpose(matrix)
        uniformMatrix("view3d", programs[0], "uView", false, matrix)
    }
    box2(0xff, blockData[t].textures)
}

function changeWorldBlock(t) {
    let pos = hitBox.pos
    if (pos && pos[1] > 0 && pos[1] < maxHeight) {
        let shape = t && blockData[t].shape
        if (t && shape.rotate) {
            let pi = Math.PI / 4
            if (p.ry <= pi) {} // North; default
            else if (p.ry < 3 * pi) {
                t |= WEST
            } else if (p.ry < 5 * pi) {
                t |= SOUTH
            } else if (p.ry < 7 * pi) {
                t |= EAST
            }
        }

        if (t && shape.flip && hitBox.face !== "top" && (hitBox.face === "bottom" || (p.direction.y * hitBox.closest + p.y) % 1 < 0.5)) {
            t |= FLIP
        }

        world.setBlock(hitBox.pos[0], hitBox.pos[1], hitBox.pos[2], t)
        if (t) {
            p.lastPlace = Date.now()
        } else {
            p.lastBreak = Date.now()
        }
    }
}

function newWorldBlock() {
    if (!hitBox.pos || !holding) {
        return
    }

    let pos = hitBox.pos,
        x = pos[0],
        y = pos[1],
        z = pos[2]
    switch (hitBox.face) {
        case "top":
            y += 1
            break
        case "bottom":
            y -= 1
            break
        case "south":
            z -= 1
            break
        case "north":
            z += 1
            break
        case "west":
            x -= 1
            break
        case "east":
            x += 1
            break
    }

    if (!inBox(x, y, z, 1, 1, 1) && !world.getBlock(x, y, z)) {
        pos[0] = x
        pos[1] = y
        pos[2] = z
        changeWorldBlock(holding < 0xff ? (holding | blockMode) : holding)
    }
}

// Save the coords for a small sphere used to carve out caves
let sphere; {
    let blocks = []
    let radius = 3.5
    let radsq = radius * radius
    for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
            for (let k = -radius; k <= radius; k++) {
                if (i * i + j * j + k * k < radsq) {
                    blocks.push(i | 0, j | 0, k | 0)
                }
            }
        }
    }
    sphere = new Int8Array(blocks)
}

function isCave(x, y, z) {
    // Generate a 3D rigid multifractal noise shell.
    // Then generate another one with different coordinates.
    // Overlay them on top of each other, and the overlapping parts should form a cave-like structure.
    // This is extremely slow, and requires generating 2 noise values for every single block in the world.
    // TODO: replace with a crawler system of some sort, that will never rely on a head position in un-generated chunks.
    const smooth = 0.02;
    const caveSize = 0.006;
    let cave1 = Math.abs(0.5 - caveNoise(x * smooth, y * smooth, z * smooth)) < caveSize
    let cave2 = Math.abs(0.5 - caveNoise(y * smooth, z * smooth, x * smooth)) < caveSize
    return (cave1 && cave2)
}

function carveSphere(x, y, z) {
    if (y > 3) {
        for (let i = 0; i < sphere.length; i += 3) {
            world.setBlock(x + sphere[i], y + sphere[i + 1], z + sphere[i + 2], blockIds.air, true)
        }
    }
}

let renderedChunks = 0

function getBlock(x, y, z, blocks) {
    return blocks[((x >> 4) + 1) * 9 + ((y >> 4) + 1) * 3 + (z >> 4) + 1][((x & 15) << 8) + ((y & 15) << 4) + (z & 15)]
}
/**
 * Returns a 1 if the face is exposed and should be drawn, or a 0 if the face is hidden
 * 
 * @param {number} x - The X coordinate of the block that may be covering a face
 * @param {number} y - The Y coordinate of the block that may be covering a face
 * @param {number} z - The Z coordinate of the block that may be covering a face
 * @param {Collection} blocks - Some collection of blocks that can return the block at (x, y, z)
 * @param {number} type - The blockstate of the block that's being considered for face culling
 * @param {function} func - The function that can be called to return a block from the blocks collection
 */
function hideFace(x, y, z, blocks, type, func, sourceDir, dir) {
    let block = func.call(world, x, y, z, blocks)
    if (!block) {
        return 1
    }

    let data = blockData[block]
    let sourceData = blockData[type]

    let sourceRange = 3
    let hiderRange = 3
    if (func !== getBlock || screen === "loading") {
        // getBlock is only used during the optimize phase of worldGen
        sourceRange = sourceData.shape.cull[sourceDir]
        hiderRange = data.shape.cull[dir]
    }

    if ((sourceRange & hiderRange) !== sourceRange || !sourceRange || block !== type && data.transparent || data.transparent && data.shadow) {
        return 1
    }
    return 0
}
let getShadows = {
    shade: [1, 0.85, 0.7, 0.6, 0.3],
    ret: [],
    blocks: [],
    top: function(x, y, z, block) { // Actually the bottom... How did these get flipped?
        let blocks = this.blocks
        let ret = this.ret
        blocks[0] = blockData[getBlock(x - 1, y - 1, z - 1, block)].shadow
        blocks[1] = blockData[getBlock(x, y - 1, z - 1, block)].shadow
        blocks[2] = blockData[getBlock(x + 1, y - 1, z - 1, block)].shadow
        blocks[3] = blockData[getBlock(x - 1, y - 1, z, block)].shadow
        blocks[4] = blockData[getBlock(x, y - 1, z, block)].shadow
        blocks[5] = blockData[getBlock(x + 1, y - 1, z, block)].shadow
        blocks[6] = blockData[getBlock(x - 1, y - 1, z + 1, block)].shadow
        blocks[7] = blockData[getBlock(x, y - 1, z + 1, block)].shadow
        blocks[8] = blockData[getBlock(x + 1, y - 1, z + 1, block)].shadow

        ret[0] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]] * 0.75
        ret[1] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]] * 0.75
        ret[2] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]] * 0.75
        ret[3] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]] * 0.75
        return ret
    },
    bottom: function(x, y, z, block) { // Actually the top
        let blocks = this.blocks
        let ret = this.ret
        blocks[0] = blockData[getBlock(x - 1, y + 1, z - 1, block)].shadow
        blocks[1] = blockData[getBlock(x, y + 1, z - 1, block)].shadow
        blocks[2] = blockData[getBlock(x + 1, y + 1, z - 1, block)].shadow
        blocks[3] = blockData[getBlock(x - 1, y + 1, z, block)].shadow
        blocks[4] = blockData[getBlock(x, y + 1, z, block)].shadow
        blocks[5] = blockData[getBlock(x + 1, y + 1, z, block)].shadow
        blocks[6] = blockData[getBlock(x - 1, y + 1, z + 1, block)].shadow
        blocks[7] = blockData[getBlock(x, y + 1, z + 1, block)].shadow
        blocks[8] = blockData[getBlock(x + 1, y + 1, z + 1, block)].shadow

        ret[0] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]]
        ret[1] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]]
        ret[2] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]]
        ret[3] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]]
        return ret
    },
    north: function(x, y, z, block) {
        let blocks = this.blocks
        let ret = this.ret
        blocks[0] = blockData[getBlock(x - 1, y - 1, z + 1, block)].shadow
        blocks[1] = blockData[getBlock(x, y - 1, z + 1, block)].shadow
        blocks[2] = blockData[getBlock(x + 1, y - 1, z + 1, block)].shadow
        blocks[3] = blockData[getBlock(x - 1, y, z + 1, block)].shadow
        blocks[4] = blockData[getBlock(x, y, z + 1, block)].shadow
        blocks[5] = blockData[getBlock(x + 1, y, z + 1, block)].shadow
        blocks[6] = blockData[getBlock(x - 1, y + 1, z + 1, block)].shadow
        blocks[7] = blockData[getBlock(x, y + 1, z + 1, block)].shadow
        blocks[8] = blockData[getBlock(x + 1, y + 1, z + 1, block)].shadow

        ret[0] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]] * 0.95
        ret[1] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]] * 0.95
        ret[2] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]] * 0.95
        ret[3] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]] * 0.95
        return ret
    },

    south: function(x, y, z, block) {
        let blocks = this.blocks
        let ret = this.ret
        blocks[0] = blockData[getBlock(x - 1, y - 1, z - 1, block)].shadow
        blocks[1] = blockData[getBlock(x - 1, y, z - 1, block)].shadow
        blocks[2] = blockData[getBlock(x - 1, y + 1, z - 1, block)].shadow
        blocks[3] = blockData[getBlock(x, y - 1, z - 1, block)].shadow
        blocks[4] = blockData[getBlock(x, y, z - 1, block)].shadow
        blocks[5] = blockData[getBlock(x, y + 1, z - 1, block)].shadow
        blocks[6] = blockData[getBlock(x + 1, y - 1, z - 1, block)].shadow
        blocks[7] = blockData[getBlock(x + 1, y, z - 1, block)].shadow
        blocks[8] = blockData[getBlock(x + 1, y + 1, z - 1, block)].shadow

        ret[0] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]] * 0.95
        ret[1] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]] * 0.95
        ret[2] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]] * 0.95
        ret[3] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]] * 0.95
        return ret
    },
    east: function(x, y, z, block) {
        let blocks = this.blocks
        let ret = this.ret
        blocks[0] = blockData[getBlock(x + 1, y - 1, z - 1, block)].shadow
        blocks[1] = blockData[getBlock(x + 1, y, z - 1, block)].shadow
        blocks[2] = blockData[getBlock(x + 1, y + 1, z - 1, block)].shadow
        blocks[3] = blockData[getBlock(x + 1, y - 1, z, block)].shadow
        blocks[4] = blockData[getBlock(x + 1, y, z, block)].shadow
        blocks[5] = blockData[getBlock(x + 1, y + 1, z, block)].shadow
        blocks[6] = blockData[getBlock(x + 1, y - 1, z + 1, block)].shadow
        blocks[7] = blockData[getBlock(x + 1, y, z + 1, block)].shadow
        blocks[8] = blockData[getBlock(x + 1, y + 1, z + 1, block)].shadow

        ret[0] = this.shade[blocks[1] + blocks[2] + blocks[4] + blocks[5]] * 0.8
        ret[1] = this.shade[blocks[5] + blocks[4] + blocks[8] + blocks[7]] * 0.8
        ret[2] = this.shade[blocks[4] + blocks[3] + blocks[7] + blocks[6]] * 0.8
        ret[3] = this.shade[blocks[0] + blocks[1] + blocks[3] + blocks[4]] * 0.8
        return ret
    },
    west: function(x, y, z, block) {
        let blocks = this.blocks
        let ret = this.ret
        blocks[0] = blockData[getBlock(x - 1, y - 1, z - 1, block)].shadow
        blocks[1] = blockData[getBlock(x - 1, y, z - 1, block)].shadow
        blocks[2] = blockData[getBlock(x - 1, y + 1, z - 1, block)].shadow
        blocks[3] = blockData[getBlock(x - 1, y - 1, z, block)].shadow
        blocks[4] = blockData[getBlock(x - 1, y, z, block)].shadow
        blocks[5] = blockData[getBlock(x - 1, y + 1, z, block)].shadow
        blocks[6] = blockData[getBlock(x - 1, y - 1, z + 1, block)].shadow
        blocks[7] = blockData[getBlock(x - 1, y, z + 1, block)].shadow
        blocks[8] = blockData[getBlock(x - 1, y + 1, z + 1, block)].shadow

        ret[0] = this.shade[blocks[7] + blocks[8] + blocks[4] + blocks[5]] * 0.8
        ret[1] = this.shade[blocks[5] + blocks[4] + blocks[2] + blocks[1]] * 0.8
        ret[2] = this.shade[blocks[4] + blocks[3] + blocks[1] + blocks[0]] * 0.8
        ret[3] = this.shade[blocks[6] + blocks[7] + blocks[3] + blocks[4]] * 0.8
        return ret
    },
}

function interpolateShadows(shadows, x, y) {
    let sx = (shadows[1] - shadows[0]) * x + shadows[0]
    let sx2 = (shadows[3] - shadows[2]) * x + shadows[2]
    return (sx2 - sx) * y + sx
}

class Section {
    constructor(x, y, z, size, chunk) {
        this.x = x
        this.y = y
        this.z = z
        this.size = size
        this.arraySize = size * size * size
        this.blocks = new Int32Array(this.arraySize)
        this.compressed = new Uint8Array(this.arraySize)
        this.renderData = []
        this.renderLength = 0
        this.faces = 0
        this.hasVisibleBlocks = false
        this.chunk = chunk
        this.edited = false
        this.caves = !caves
        this.pallete = [0]
        this.palleteMap = {
            "0": 0
        }
        this.palleteSize = 0
    }
    getBlock(x, y, z) {
        let s = this.size
        return this.blocks[x * s * s + y * s + z]
    }
    setBlock(x, y, z, blockId) {
        let s = this.size
        this.blocks[x * s * s + y * s + z] = blockId
    }
    deleteBlock(x, y, z) {
        let s = this.size
        this.blocks[x * s * s + y * s + z] = 0
    }
    optimize() {
        let visible = false
        let pos = 0
        let xx = this.x
        let yy = this.y
        let zz = this.z
        let blockState = 0
        let palleteIndex = 0
        let index = 0
        let s = this.size
        let blocks = this.blocks
        this.hasVisibleBlocks = false
        this.renderLength = 0
        let localBlocks = world.getAdjacentSubchunks(xx, yy, zz)

        //Check all the blocks in the subchunk to see if they're visible.
        for (let i = 0; i < s; i++) {
            for (let j = 0; j < s; j++) {
                for (let k = 0; k < s; k++, index++) {
                    blockState = blocks[index]

                    if (this.palleteMap[blockState] === undefined) {
                        this.palleteMap[blockState] = this.pallete.length
                        palleteIndex = this.pallete.length
                        this.pallete.push(blockState)
                    } else {
                        palleteIndex = this.palleteMap[blockState]
                    }

                    visible = blockState && (hideFace(i - 1, j, k, localBlocks, blockState, getBlock, "west", "east") |
                        hideFace(i + 1, j, k, localBlocks, blockState, getBlock, "east", "west") << 1 |
                        hideFace(i, j - 1, k, localBlocks, blockState, getBlock, "bottom", "top") << 2 |
                        hideFace(i, j + 1, k, localBlocks, blockState, getBlock, "top", "bottom") << 3 |
                        hideFace(i, j, k - 1, localBlocks, blockState, getBlock, "south", "north") << 4 |
                        hideFace(i, j, k + 1, localBlocks, blockState, getBlock, "north", "south") << 5)
                    if (visible) {
                        pos = (i | j << 4 | k << 8) << 19
                        this.renderData[this.renderLength++] = 1 << 31 | pos | visible << 13 | palleteIndex
                        this.hasVisibleBlocks = true
                    }
                }
            }
        }
    }
    updateBlock(x, y, z, world) {
        if (!world.meshQueue.includes(this.chunk)) {
            world.meshQueue.push(this.chunk)
        }
        let i = x
        let j = y
        let k = z
        let s = this.size
        x += this.x
        y += this.y
        z += this.z
        let blockState = this.blocks[i * s * s + j * s + k]
        let visible = blockState && (hideFace(x - 1, y, z, 0, blockState, world.getBlock, "west", "east") |
            hideFace(x + 1, y, z, 0, blockState, world.getBlock, "east", "west") << 1 |
            hideFace(x, y - 1, z, 0, blockState, world.getBlock, "bottom", "top") << 2 |
            hideFace(x, y + 1, z, 0, blockState, world.getBlock, "top", "bottom") << 3 |
            hideFace(x, y, z - 1, 0, blockState, world.getBlock, "south", "north") << 4 |
            hideFace(x, y, z + 1, 0, blockState, world.getBlock, "north", "south") << 5)
        let pos = (i | j << 4 | k << 8) << 19
        let index = -1

        // Find index of current block in this.renderData
        for (let i = 0; i < this.renderLength; i++) {
            if ((this.renderData[i] & 0x7ff80000) === pos) {
                index = i
                break
            }
        }

        // Update pallete
        if (this.palleteMap[blockState] === undefined) {
            this.palleteMap[blockState] = this.pallete.length
            this.pallete.push(blockState)
        }

        if (index < 0 && !visible) {
            // Wasn't visible before, isn't visible after.
            return
        }
        if (!visible) {
            // Was visible before, isn't visible after.
            this.renderData.splice(index, 1)
            this.renderLength--
            this.hasVisibleBlocks = !!this.renderLength
            return
        }
        if (visible && index < 0) {
            // Wasn't visible before, is visible after.
            index = this.renderLength++
            this.hasVisibleBlocks = true
        }
        this.renderData[index] = 1 << 31 | pos | visible << 13 | this.palleteMap[blockState]
    }
    genMesh(barray, index) {
        if (!this.renderLength) {
            return index
        }
        let length = this.renderLength
        let rData = this.renderData
        let x = 0,
            y = 0,
            z = 0,
            loc = 0,
            data = 0,
            sides = 0,
            tex = null,
            x2 = 0,
            y2 = 0,
            z2 = 0,
            verts = null,
            texVerts = null,
            texShapeVerts = null,
            tx = 0,
            ty = 0
        let wx = this.x,
            wy = this.y,
            wz = this.z
        let blocks = world.getAdjacentSubchunks(wx, wy, wz)
        let block = null

        let shadows = null
        let blockSides = Object.keys(Block)
        let side = ""
        let shapeVerts = null
        let shapeTexVerts = null
        let pallete = this.pallete

        for (let i = 0; i < length; i++) {
            data = rData[i]
            block = blockData[pallete[data & 0x1fff]]
            tex = block.textures
            sides = data >> 13 & 0x3f
            loc = data >> 19 & 0xfff
            x = loc & 15
            y = loc >> 4 & 15
            z = loc >> 8 & 15

            x2 = x + this.x
            y2 = y + this.y
            z2 = z + this.z

            shapeVerts = block.shape.verts
            shapeTexVerts = block.shape.texVerts

            let texNum = 0
            for (let n = 0; n < 6; n++) {
                side = blockSides[n]
                if (sides & Block[side]) {
                    shadows = getShadows[side](x, y, z, blocks)
                    let directionalFaces = shapeVerts[Sides[side]]
                    for (let facei = 0; facei < directionalFaces.length; facei++) {
                        verts = directionalFaces[facei]
                        texVerts = textureCoords[textureMap[tex[texNum]]]
                        tx = texVerts[0]
                        ty = texVerts[1]
                        texShapeVerts = shapeTexVerts[n][facei]

                        barray[index] = verts[0] + x2
                        barray[index + 1] = verts[1] + y2
                        barray[index + 2] = verts[2] + z2
                        barray[index + 3] = tx + texShapeVerts[0]
                        barray[index + 4] = ty + texShapeVerts[1]
                        barray[index + 5] = shadows[0]

                        barray[index + 6] = verts[3] + x2
                        barray[index + 7] = verts[4] + y2
                        barray[index + 8] = verts[5] + z2
                        barray[index + 9] = tx + texShapeVerts[2]
                        barray[index + 10] = ty + texShapeVerts[3]
                        barray[index + 11] = shadows[1]

                        barray[index + 12] = verts[6] + x2
                        barray[index + 13] = verts[7] + y2
                        barray[index + 14] = verts[8] + z2
                        barray[index + 15] = tx + texShapeVerts[4]
                        barray[index + 16] = ty + texShapeVerts[5]
                        barray[index + 17] = shadows[2]

                        barray[index + 18] = verts[9] + x2
                        barray[index + 19] = verts[10] + y2
                        barray[index + 20] = verts[11] + z2
                        barray[index + 21] = tx + texShapeVerts[6]
                        barray[index + 22] = ty + texShapeVerts[7]
                        barray[index + 23] = shadows[3]
                        index += 24
                    }
                }
                texNum++
            }
        }
        return index
    }
  
    carveCaves() {
        let wx = this.x + 16,
            wz = this.z + 16,
            wy = this.y + 16
        for (let x = this.x, xx = 0; x < wx; x++, xx++) {
            for (let z = this.z, zz = 0; z < wz; z++, zz++) {
                wy = this.chunk.tops[zz * 16 + xx]
                for (let y = this.y; y < wy; y++) {
                    if (isCave(x, y, z)) {
                        carveSphere(x, y, z)
                    }
                }
            }
        }
        this.caves = true
    }
  
    tick() {
        for (let i = 0; i < 3; i++) {
            let rnd = Math.random() * this.blocks.length | 0
            if ((this.blocks[rnd]) === blockIds.grass) {
                // Spread grass

                let x = (rnd >> 8) + this.x
                let y = (rnd >> 4 & 15) + this.y
                let z = (rnd & 15) + this.z
                if (!blockData[world.getBlock(x, y + 1, z)].transparent) {
                    world.setBlock(x, y, z, blockIds.dirt, false)
                    return;
                }

                let rnd2 = Math.random() * 27 | 0
                let x2 = rnd2 % 3 - 1
                rnd2 = (rnd2 - x2 - 1) / 3
                let y2 = rnd2 % 3 - 1
                rnd2 = (rnd2 - y2 - 1) / 3
                z += rnd2 - 1
                x += x2
                y += y2

                if (world.getBlock(x, y, z) === blockIds.dirt && world.getBlock(x, y + 1, z) === blockIds.air) {
                    world.setBlock(x, y, z, blockIds.grass, false)
                }
            }
        }
    }
}
let emptySection = new Section(0, 0, 0, 16)
let fullSection = new Section(0, 0, 0, 16)
fullSection.blocks.fill(blockIds.bedrock)

class Chunk {
    constructor(x, z) {
        this.x = x
        this.z = z
        this.maxY = 0
        this.minY = 255
        this.sections = []
        this.cleanSections = []
        this.tops = new Uint8Array(16 * 16); // Store the heighest block at every (x,z) coordinate
        this.optimized = false
        this.generated = false; // Terrain
        this.populated = superflat; // Trees and ores
        this.lit = false; // Has lighting been calculated?
        this.lazy = false
        this.edited = false
        this.loaded = false
        this.caves = !caves;

        this.vao = gl.createVertexArray(); // Backporting optimization is fun
    }

    getBlock(x, y, z) {
        let s = y >> 4
        return this.sections.length > s ? this.sections[s].getBlock(x, y & 15, z) : 0
    }

    setBlock(x, y, z, blockID, hidden, user) {
        if (!this.sections[y >> 4]) {
            do {
                this.sections.push(new Section(this.x, this.sections.length * 16, this.z, 16, this))
            } while (!this.sections[y >> 4])
        }

        if (user && !this.sections[y >> 4].edited) {
            this.cleanSections[y >> 4] = this.sections[y >> 4].blocks.slice()
            this.sections[y >> 4].edited = true
            this.edited = true
        }
        this.sections[y >> 4].setBlock(x, y & 15, z, blockID, hidden)
    }

    optimize() {
        for (let i = 0; i < this.sections.length; i++) {
            this.sections[i].optimize()
        }
        if (!world.meshQueue.includes(this)) {
            world.meshQueue.push(this)
        }
        this.optimized = true
    }

    render() {
        if (!this.buffer) {
            return;
        }

        if (p.canSee(this.x, this.minY, this.z, this.maxY)) {
            renderedChunks++
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
            gl.bindVertexArray(this.vao);
            gl.drawElements(gl.TRIANGLES, 6 * this.faces, gl.UNSIGNED_INT, 0);
            gl.bindVertexArray(null);
        }
    }

    updateBlock(x, y, z, world, lazy) {
        if (this.buffer) {
            this.lazy = lazy
            if (this.sections.length > y >> 4) {
                this.sections[y >> 4].updateBlock(x, y & 15, z, world)
            }
        }


    }

    deleteBlock(x, y, z, user) {
        if (!this.sections[y >> 4]) {
            return
        }
        if (user && !this.sections[y >> 4].edited) {
            this.cleanSections[y >> 4] = this.sections[y >> 4].blocks.slice()
            this.sections[y >> 4].edited = true
            this.edited = true
        }
        this.sections[y >> 4].deleteBlock(x, y & 15, z)
        this.minY = y < this.minY ? y : this.minY
        this.maxY = y > this.maxY ? y : this.maxY
    }
  
    carveCaves() {
        for (let i = 0; i < this.sections.length; i++) {
            if (!this.sections[i].caves) {
                this.sections[i].carveCaves()
                if (i + 1 >= this.sections.length) {
                    this.caves = true
                }
                return
            }
        }
    } // To-do: Optimize Generation
  
    populate() {
        randomSeed(hash(this.x, this.z) * 210000000)
        let wx = 0,
            wz = 0,
            ground = 0,
            top = 0,
            rand = 0,
            place = false

        for (let i = 0; i < 16; i++) {
            for (let k = 0; k < 16; k++) {
                wx = this.x + i
                wz = this.z + k
                ground = this.tops[k * 16 + i]
                if (trees && random() < 0.005 && this.getBlock(i, ground, k)) {

                    top = ground + Math.floor(4.5 + random(2.5))
                    rand = Math.floor(random(4096))
                    let tree = random() < 0.6 ? blockIds.oakLog : ++top && blockIds.birchLog

                    //Center
                    for (let j = ground + 1; j <= top; j++) {
                        this.setBlock(i, j, k, tree)
                    }
                    this.setBlock(i, top + 1, k, blockIds.leaves)
                    this.setBlock(i, ground, k, blockIds.dirt)

                    //Bottom leaves
                    for (let x = -2; x <= 2; x++) {
                        for (let z = -2; z <= 2; z++) {
                            if (x || z) {
                                if ((x * z & 7) === 4) {
                                    place = rand & 1
                                    rand >>>= 1
                                    if (place) {
                                        world.spawnBlock(wx + x, top - 2, wz + z, blockIds.leaves)
                                    }
                                } else {
                                    world.spawnBlock(wx + x, top - 2, wz + z, blockIds.leaves)
                                }
                            }
                        }
                    }

                    //2nd layer leaves
                    for (let x = -2; x <= 2; x++) {
                        for (let z = -2; z <= 2; z++) {
                            if (x || z) {
                                if ((x * z & 7) === 4) {
                                    place = rand & 1
                                    rand >>>= 1
                                    if (place) {
                                        world.spawnBlock(wx + x, top - 1, wz + z, blockIds.leaves)
                                    }
                                } else {
                                    world.spawnBlock(wx + x, top - 1, wz + z, blockIds.leaves)
                                }
                            }
                        }
                    }

                    //3rd layer leaves
                    for (let x = -1; x <= 1; x++) {
                        for (let z = -1; z <= 1; z++) {
                            if (x || z) {
                                if (x & z) {
                                    place = rand & 1
                                    rand >>>= 1
                                    if (place) {
                                        world.spawnBlock(wx + x, top, wz + z, blockIds.leaves)
                                    }
                                } else {
                                    world.spawnBlock(wx + x, top, wz + z, blockIds.leaves)
                                }
                            }
                        }
                    }

                    //Top leaves
                    world.spawnBlock(wx + 1, top + 1, wz, blockIds.leaves)
                    world.spawnBlock(wx, top + 1, wz - 1, blockIds.leaves)
                    world.spawnBlock(wx, top + 1, wz + 1, blockIds.leaves)
                    world.spawnBlock(wx - 1, top + 1, wz, blockIds.leaves)
                }

                // Blocks of each per chunk in Minecraft
                // Coal: 185.5
                // Iron: 111.5
                // Gold: 10.4
                // Redstone: 29.1
                // Diamond: 3.7
                // Lapis: 4.1
                ground -= 4

                if (random() < 3.7 / 256) {
                    let y = random() * 16 | 0 + 1
                    y = y < ground ? y : ground
                    if (this.getBlock(i, y, k)) {
                        this.setBlock(i, y < ground ? y : ground, k, blockIds.diamondOre)
                    }
                }

                if (random() < 111.5 / 256) {
                    let y = random() * 64 | 0 + 1
                    y = y < ground ? y : ground
                    if (this.getBlock(i, y, k)) {
                        this.setBlock(i, y < ground ? y : ground, k, blockIds.ironOre)
                    }
                }

                if (random() < 185.5 / 256) {
                    let y = random() * ground | 0 + 1
                    y = y < ground ? y : ground
                    if (this.getBlock(i, y, k)) {
                        this.setBlock(i, y < ground ? y : ground, k, blockIds.coalOre)
                    }
                }

                if (random() < 10.4 / 256) {
                    let y = random() * 32 | 0 + 1
                    y = y < ground ? y : ground
                    if (this.getBlock(i, y, k)) {
                        this.setBlock(i, y < ground ? y : ground, k, blockIds.goldOre)
                    }
                }

                if (random() < 29.1 / 256) {
                    let y = random() * 16 | 0 + 1
                    y = y < ground ? y : ground
                    if (this.getBlock(i, y, k)) {
                        this.setBlock(i, y < ground ? y : ground, k, blockIds.redstoneOre)
                    }
                }

                if (random() < 4.1 / 256) {
                    let y = random() * 32 | 0 + 1
                    y = y < ground ? y : ground
                    if (this.getBlock(i, y, k)) {
                        this.setBlock(i, y < ground ? y : ground, k, blockIds.lapisOre)
                    }
                }
            }
        }

        this.populated = true
    }

    genMesh() {
        let start = win.performance.now()
        let barray = bigArray
        let index = 0
        for (let i = 0; i < this.sections.length; i++) {
            index = this.sections[i].genMesh(barray, index)
        }
        let arrayDone = win.performance.now()

        if (!this.buffer) {
            this.buffer = gl.createBuffer()
        }
        let data = barray.slice(0, index)

        let maxY = 0
        let minY = 255
        let y = 0
        for (let i = 1; i < data.length; i += 6) {
            y = data[i]
            maxY = Math.max(maxY, y)
            minY = Math.min(minY, y)
        }
        this.maxY = maxY
        this.minY = minY
        this.faces = data.length / 24
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
        gl.vertexAttribPointer(glUniforms.aVertex, 3, gl.FLOAT, false, 24, 0)
        gl.enableVertexAttribArray(glUniforms.aVertex)
        gl.vertexAttribPointer(glUniforms.aTexture, 2, gl.FLOAT, false, 24, 12)
        gl.enableVertexAttribArray(glUniforms.aTexture)
        gl.vertexAttribPointer(glUniforms.aShadow, 1, gl.FLOAT, false, 24, 20)
        gl.enableVertexAttribArray(glUniforms.aShadow)
        gl.bindVertexArray(null);
        this.lazy = false
    }
    tick() {
        if (this.edited) {
            for (let i = 0; i < this.sections.length; i++) {
                if (this.sections[i].edited) {
                    this.sections[i].tick()
                }
            }
        }
    }
    load() {
        let chunkX = this.x >> 4
        let chunkZ = this.z >> 4
        let load = null

        for (let i = 0; i < world.loadFrom.length; i++) {
            load = world.loadFrom[i]
            if (load.x === chunkX && load.z === chunkZ) {
                let y = load.y * 16
                for (let j in load.blocks) {
                    world.setBlock((j >> 8 & 15) + this.x, (j >> 4 & 15) + y, (j & 15) + this.z, load.blocks[j])
                }
                world.loadFrom.splice(i--, 1)
            }
        }
        this.loaded = true
    }
}

let analytics = {
    totalTickTime: 0,
    worstFrameTime: 0,
    totalRenderTime: 0,
    totalFrameTime: 0,
    lastUpdate: 0,
    frames: 1,
    displayedTickTime: "0",
    displayedRenderTime: "0",
    displayedFrameTime: "0",
    displayedwFrameTime: 0,
    fps: 0,
}

function chunkDist(c) {
    let dx = p.x - c.x
    let dz = p.z - c.z
    if (dx > 16) {
        dx -= 16
    } else if (dx > 0) {
        dx = 0
    }
    if (dz > 16) {
        dz -= 16
    } else if (dz > 0) {
        dz = 0
    }
    return Math.sqrt(dx * dx + dz * dz)
}

function sortChunks(c1, c2) { //Sort the list of chunks based on distance from the player
    let dx1 = p.x - c1.x - 8
    let dy1 = p.z - c1.z - 8
    let dx2 = p.x - c2.x - 8
    let dy2 = p.z - c2.z - 8
    return dx1 * dx1 + dy1 * dy1 - (dx2 * dx2 + dy2 * dy2)
}

function fillReqs(x, z) {
    // Chunks must all be loaded first.
    let done = true
    for (let i = x - 2; i <= x + 2; i++) {
        for (let j = z - 2; j <= z + 2; j++) {
            let chunk = world.loaded[(i + world.offsetX) * world.lwidth + j + world.offsetZ]
            if (!chunk.generated) {
                world.generateQueue.push(chunk)
                done = false
            }
            if (!chunk.populated && i >= x - 1 && i <= x + 1 && j >= z - 1 && j <= z + 1) {
                world.populateQueue.push(chunk)
                done = false
            }
        }
    }
    return done
}

function maxDist(x, z, x2, z2) {
    let ax = Math.abs(x2 - x)
    let az = Math.abs(z2 - z)
    return Math.max(ax, az)
}

function renderFilter(chunk) {
    return maxDist(chunk.x >> 4, chunk.z >> 4, p.cx, p.cz) <= settings.renderDistance
}

function debug(message) {
    let ellapsed = performance.now() - debug.start
    if (ellapsed > 30) {
        console.log(message, ellapsed.toFixed(2), "milliseconds")
    }
}

let fogDist = 16
class World {
    constructor() {
        generatedChunks = 0
        fogDist = 16
        p.y = superflat ? 6 : (Math.round(noise(8 * generator.smooth, 8 * generator.smooth) * generator.height) + 2 + generator.extra)

        //Initialize the world's arrays
        this.chunks = []
        this.loaded = []
        this.sortedChunks = []
        this.offsetX = 0
        this.offsetZ = 0
        this.lwidth = 0
        this.chunkGenQueue = []
        this.populateQueue = []
        this.generateQueue = []
        this.meshQueue = []
        this.loadFrom = []
        this.lastChunk = ","
    }
    genChunk(chunk) {
        let x = chunk.x >> 4
        let z = chunk.z >> 4
        let trueX = chunk.x
        let trueZ = chunk.z

        if (chunk.generated) {
            return false
        }

        let smoothness = generator.smooth
        let hilliness = generator.height
        let gen = 0
        for (let i = 0; i < 16; i++) {
            for (let k = 0; k < 16; k++) {
                gen = superflat ? 4 : Math.round(noise((trueX + i) * smoothness, (trueZ + k) * smoothness) * hilliness) + generator.extra
                chunk.tops[k * 16 + i] = gen

                chunk.setBlock(i, gen, k, blockIds.grass)
                chunk.setBlock(i, gen - 1, k, blockIds.dirt)
                chunk.setBlock(i, gen - 2, k, blockIds.dirt)
                chunk.setBlock(i, gen - 3, k, blockIds.dirt)
                for (let j = 1; j < gen - 3; j++) {
                    chunk.setBlock(i, j, k, blockIds.stone)
                }
                chunk.setBlock(i, 0, k, blockIds.bedrock)
            }
        }
        chunk.generated = true
    }
    getAdjacentSubchunks(x, y, z) {
        let minChunkX = x - 16 >> 4
        let maxChunkX = x + 16 >> 4
        let minChunkY = y - 16 >> 4
        let maxChunkY = y + 16 >> 4
        let minChunkZ = z - 16 >> 4
        let maxChunkZ = z + 16 >> 4
        let section = null
        let ret = []
        for (x = minChunkX; x <= maxChunkX; x++) {
            for (let y = minChunkY; y <= maxChunkY; y++) {
                for (z = minChunkZ; z <= maxChunkZ; z++) {
                    if (y < 0) {
                        ret.push(fullSection.blocks)
                    } else if (this.chunks[x] && this.chunks[x][z]) {
                        section = this.chunks[x][z].sections[y] || emptySection
                        ret.push(section.blocks)
                    } else {
                        ret.push(emptySection.blocks)
                    }
                }
            }
        }
        return ret
    }
    updateBlock(x, y, z, lazy) {
        let chunk = this.chunks[x >> 4] && this.chunks[x >> 4][z >> 4]
        if (chunk && chunk.buffer) {
            chunk.updateBlock(x & 15, y, z & 15, this, lazy)
        }
    }
    getWorldBlock(x, y, z) {
        if (!this.chunks[x >> 4] || !this.chunks[x >> 4][z >> 4]) {
            return blockIds.air
        }
        return this.chunks[x >> 4][z >> 4].getBlock(x & 15, y, z & 15)
    }
    getBlock(x, y, z) {
        let X = (x >> 4) + this.offsetX
        let Z = (z >> 4) + this.offsetZ
        if (y > maxHeight) {
            return blockIds.air
        } else if (y < 0) {
            return blockIds.bedrock
        } else if (X < 0 || X >= this.lwidth || Z < 0 || Z >= this.lwidth) {
            return this.getWorldBlock(x, y, z)
        }
        return this.loaded[X * this.lwidth + Z].getBlock(x & 15, y, z & 15)
    }
    setBlock(x, y, z, blockID, lazy) {
        if (!this.chunks[x >> 4] || !this.chunks[x >> 4][z >> 4]) {
            return
        }
        let chunk = this.chunks[x >> 4][z >> 4]

        let xm = x & 15
        let zm = z & 15
        if (blockID) {
            chunk.setBlock(xm, y, zm, blockID, false, !lazy)
        } else {
            chunk.deleteBlock(xm, y, zm, !lazy)
        }

        if (lazy) {
            return
        }

        //Update the 6 adjacent blocks and 1 changed block
        if (xm && xm !== 15 && zm && zm !== 15) {
            chunk.updateBlock(xm - 1, y, zm, this, lazy)
            chunk.updateBlock(xm + 1, y, zm, this, lazy)
            chunk.updateBlock(xm, y - 1, zm, this, lazy)
            chunk.updateBlock(xm, y + 1, zm, this, lazy)
            chunk.updateBlock(xm, y, zm - 1, this, lazy)
            chunk.updateBlock(xm, y, zm + 1, this, lazy)
        } else {
            this.updateBlock(x - 1, y, z, lazy)
            this.updateBlock(x + 1, y, z, lazy)
            this.updateBlock(x, y - 1, z, lazy)
            this.updateBlock(x, y + 1, z, lazy)
            this.updateBlock(x, y, z - 1, lazy)
            this.updateBlock(x, y, z + 1, lazy)
        }

        chunk.updateBlock(xm, y, zm, this, lazy)

        // Update the corner chunks so shadows in adjacent chunks update correctly
        if (xm | !zm) {
            this.updateBlock(x - 1, y, z - 1, lazy);
        }
        if (xm === 15 && !zm) {
            this.updateBlock(x + 1, y, z - 1, lazy);
        }
        if (!xm && zm === 15) {
            this.updateBlock(x - 1, y, z + 1, lazy);
        }
        if (xm & zm === 15) {
            this.updateBlock(x + 1, y, z + 1, lazy);
        }
    }
    spawnBlock(x, y, z, blockID) {
        //Sets a block anywhere without causing block updates around it. Only to be used in world gen.
        let chunkX = x >> 4
        let chunkZ = z >> 4
        if (!this.chunks[chunkX]) {
            this.chunks[chunkX] = []
        }

        let chunk = this.chunks[chunkX][chunkZ]
        if (!chunk) {
            chunk = new Chunk(chunkX * 16, chunkZ * 16)
            this.chunks[chunkX][chunkZ] = chunk
        }
        if (chunk.buffer) {
            //Only used if spawning a block post-gen
            this.setBlock(x, y, z, blockID, true)
        } else if (!chunk.getBlock(x & 15, y, z & 15)) {
            chunk.setBlock(x & 15, y, z & 15, blockID, false)
        }
    }
    tick() {
        let tickStart = win.performance.now()
        let maxChunkX = (p.x >> 4) + settings.renderDistance
        let maxChunkZ = (p.z >> 4) + settings.renderDistance
        let chunk = maxChunkX + "," + maxChunkZ
        if (chunk !== this.lastChunk) {
            this.lastChunk = chunk
            this.loadChunks()
            this.chunkGenQueue.sort(sortChunks)
        }

        if (Key.leftMouse && !Key.control && p.lastBreak < Date.now() - 250 && screen === "play") {
            changeWorldBlock(0)
        }
        if ((Key.rightMouse || Key.leftMouse && Key.control) && p.lastPlace < Date.now() - 250) {
            newWorldBlock()
        }
        if (Key.leftMouse && p.autoBreak && !Key.control) {
            changeWorldBlock(0)
        }

        let _sort_ln = this.sortedChunks.length;
        for (let i = 0; i < _sort_ln; i++) {
            this.sortedChunks[i].tick()
        }

        do {
            let doneWork = false
            debug.start = performance.now()
            if (this.meshQueue.length) {
                // Update all chunk meshes.
                let len = this.meshQueue.length - 1
                do {
                    this.meshQueue.pop().genMesh()
                } while (this.meshQueue.length)
                doneWork = true
                debug("Meshes")
            }

            if (this.generateQueue.length && !doneWork) {
                let chunk = this.generateQueue.pop()
                this.genChunk(chunk)
                doneWork = true
            }

            if (this.populateQueue.length && !doneWork) {
                let chunk = this.populateQueue[this.populateQueue.length - 1]
                if (!chunk.caves) {
                    chunk.carveCaves()
                    debug("Carve caves")
                } else if (!chunk.populated) {
                    chunk.populate()
                    this.populateQueue.pop()
                }
                doneWork = true
            }

            if (this.chunkGenQueue.length && !doneWork) {
                let chunk = this.chunkGenQueue[0]
                if (!fillReqs(chunk.x >> 4, chunk.z >> 4)) {} else if (!chunk.loaded) {
                    chunk.load()
                } else if (!chunk.optimized) {
                    chunk.optimize(this)
                    debug("Optimize")
                } else if (!chunk.buffer) {
                    chunk.genMesh()
                    debug("Initial mesh")
                } else {
                    this.chunkGenQueue.shift()
                    generatedChunks++
                }

                doneWork = true
            }
            if (!doneWork) {
                break
            }
        } while (win.performance.now() - tickStart < 5)
    }
    render() {
        initModelView(p)
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)

        p2.x = Math.round(p.x)
        p2.y = Math.round(p.y)
        p2.z = Math.round(p.z)

        renderedChunks = 0

        let dist = (settings.renderDistance) * 16
        if (this.chunkGenQueue.length) {
            this.chunkGenQueue.sort(sortChunks)
            let chunk = this.chunkGenQueue[0]
            dist = Math.min(dist, chunkDist(chunk))
        }

        if (dist !== fogDist) {
            if (fogDist < dist - 0.1) fogDist += (dist - fogDist) / 120
            else if (fogDist > dist + 0.1) fogDist += (dist - fogDist) / 30
            else fogDist = dist
        }

        gl.uniform3f(glUniforms.uPos, p.x, p.y, p.z)
        gl.uniform1f(glUniforms.uDist, fogDist)

        let c = this.sortedChunks
        for (let chunk of c) {
            chunk.render()
        }

        gl.uniform3f(glUniforms.uPos, 0, 0, 0)

        if (hitBox.pos) {
            blockOutlines = true
            blockFill = false
            block2(hitBox.pos[0], hitBox.pos[1], hitBox.pos[2], 0, p)
            blockOutlines = false
            blockFill = true
        }
    }

    loadChunks() {
        let renderDistance = settings.renderDistance + 2
        let cx = p.x >> 4
        let cz = p.z >> 4
        p.cx = cx
        p.cz = cz
        let minChunkX = cx - renderDistance
        let maxChunkX = cx + renderDistance
        let minChunkZ = cz - renderDistance
        let maxChunkZ = cz + renderDistance

        this.offsetX = -minChunkX
        this.offsetZ = -minChunkZ
        this.lwidth = renderDistance * 2 + 1
        this.chunkGenQueue.length = 0

        if (this.loaded.length > this.lwidth * this.lwidth) {
            this.loaded.length = this.lwidth * this.lwidth
        }

        let i = 0
        for (let x = minChunkX; x <= maxChunkX; x++) {
            for (let z = minChunkZ; z <= maxChunkZ; z++) {
                let chunk
                if (!this.chunks[x]) {
                    this.chunks[x] = []
                }
                if (!this.chunks[x][z]) {
                    chunk = new Chunk(x * 16, z * 16)
                    if (maxDist(cx, cz, x, z) <= settings.renderDistance) {
                        this.chunkGenQueue.push(chunk)
                    }
                    this.chunks[x][z] = chunk
                }
                chunk = this.chunks[x][z]
                if (!chunk.buffer && !this.chunkGenQueue.includes(chunk) && maxDist(cx, cz, x, z) <= settings.renderDistance) {
                    this.chunkGenQueue.push(chunk)
                }
                this.loaded[i++] = chunk
            }
        }
        this.sortedChunks = this.loaded.filter(renderFilter)
        this.sortedChunks.sort(sortChunks)
    }
    getSaveString() {
        let edited = []
        for (let x in this.chunks) {
            for (let z in this.chunks[x]) {
                let chunk = this.chunks[x][z]
                if (chunk.edited) {
                    for (let y = 0; y < chunk.sections.length; y++) {
                        if (chunk.sections[y].edited) {
                            edited.push([chunk.sections[y], chunk.cleanSections[y]])
                        }
                    }
                }
            }
        }

        let pallete = {}
        for (let chunks of edited) {
            let changes = false
            chunks[0].blocks.forEach((id, i) => {
                if (id !== chunks[1][i]) {
                    pallete[id] = true
                    changes = true
                }
            })
            if (!changes) {
                chunks[0].edited = false
            }
        }

        let blocks = Object.keys(pallete).map(n => Number(n))
        pallete = {}
        blocks.forEach((block, index) => pallete[block] = index)

        let rnd = Math.round
        let options = p.flying | superflat << 1 | p.spectator << 2 | caves << 3 | trees << 4

        let str = world.name + ";" + worldSeed.toString(36) + ";" +
            rnd(p.x).toString(36) + "," + rnd(p.y).toString(36) + "," + rnd(p.z).toString(36) + "," +
            (p.rx * 100 | 0).toString(36) + "," + (p.ry * 100 | 0).toString(36) + "," + options.toString(36) + ";" +
            version + ";" +
            blocks.map(b => b.toString(36)).join(",") + ";"

        for (let i = 0; i < edited.length; i++) {
            if (!edited[i][0].edited) {
                continue
            }
            let real = edited[i][0]
            let blocks = real.blocks
            let original = edited[i][1]
            str += (real.x / 16).toString(36) + "," + (real.y / 16).toString(36) + "," + (real.z / 16).toString(36) + ","
            for (let j = 0; j < original.length; j++) {
                if (blocks[j] !== original[j]) {
                    str += (pallete[blocks[j]] << 12 | j).toString(36) + ","
                }
            }
            str = str.substr(0, str.length - 1); //Remove trailing comma
            str += ";"
        }
        if (str.match(/;$/)) str = str.substr(0, str.length - 1)
        return str
    }
    loadSave(str) {
        let data = str.split(";")

        this.name = data.shift()
        worldSeed = parseInt(data.shift(), 36)
        seedHash(worldSeed)
        caveNoise = openSimplexNoise(worldSeed)
        noiseSeed(worldSeed)

        let playerData = data.shift().split(",")
        p.x = parseInt(playerData[0], 36)
        p.y = parseInt(playerData[1], 36)
        p.z = parseInt(playerData[2], 36)
        p.rx = parseInt(playerData[3], 36) / 100
        p.ry = parseInt(playerData[4], 36) / 100
        let options = parseInt(playerData[5], 36)
        p.flying = options & 1
        p.spectator = options >> 2 & 1
        superflat = options >> 1 & 1
        caves = options >> 3 & 1
        trees = options >> 4 & 1

        let _v = data.shift(); // Version of the World (I renamed it because of globals)
        this.version = _v

        let pallete = data.shift().split(",").map(n => parseInt(n, 36))
        this.loadFrom = []

        for (let i = 0; data.length; i++) {
            let blocks = data.shift().split(",")
            this.loadFrom.push({
                x: parseInt(blocks.shift(), 36),
                y: parseInt(blocks.shift(), 36),
                z: parseInt(blocks.shift(), 36),
                blocks: [],
            })
            for (let j = 0; j < blocks.length; j++) {
                let block = parseInt(blocks[j], 36)
                let index = block & 0xffffff
                let pid = block >> 12
                this.loadFrom[i].blocks[index] = pallete[pid]
            }
        }
    }
}

function defineWorld() {
    let tickStart = win.performance.now()
    world.tick()
    analytics.totalTickTime += win.performance.now() - tickStart
    let renderStart = win.performance.now()
    world.render()
    analytics.totalRenderTime += win.performance.now() - renderStart
}

function controls() {
    move.x = 0
    move.z = 0
    let dt = (win.performance.now() - p.lastUpdate) / 33
    dt = dt > 2 ? 2 : dt

    if (Key.w) move.z += p.speed
    if (Key.s) move.z -= p.speed
    if (Key.a) move.x += p.speed
    if (Key.d) move.x -= p.speed
    if (p.flying) {
        if (Key[" "]) p.velocity.y += 0.06 * dt
        if (Key.shift) p.velocity.y -= 0.06 * dt
    }
    if (Key.arrowleft) p.ry -= 0.1 * dt
    if (Key.arrowright) p.ry += 0.1 * dt
    if (Key.arrowup) p.rx += 0.1 * dt
    if (Key.arrowdown) p.rx -= 0.1 * dt

    if (!p.sprinting && Key.q && !p.sneaking && Key.w) {
        p.FOV(settings.fov + 10, 250)
        p.sprinting = true
    }

    if (p.sprinting) {
        move.x *= p.sprintSpeed
        move.z *= p.sprintSpeed
    }

    if (p.flying) {
        move.x *= p.flySpeed
        move.z *= p.flySpeed
    }

    if (!move.x && !move.z) {
        if (p.sprinting) {
            p.FOV(settings.fov, 100)
        }

        p.sprinting = false
    } else if (Math.abs(move.x) > 0 && Math.abs(move.z) > 0) {
        move.x *= move.ang
        move.z *= move.ang
    }

    //Update the velocity, rather than the position.
    let co = Math.cos(p.ry)
    let si = Math.sin(p.ry)
    let friction = p.onGround ? 1 : 0.3
    p.velocity.x += (co * move.x - si * move.z) * friction * dt
    p.velocity.z += (si * move.x + co * move.z) * friction * dt

    const TAU = Math.PI * 2
    const PI1_2 = Math.PI / 2
    while (p.ry > TAU) p.ry -= TAU
    while (p.ry < 0) p.ry += TAU
    if (p.rx > PI1_2) p.rx = PI1_2
    if (p.rx < -PI1_2) p.rx = -PI1_2

    p.setDirection()
}

// Mouse sensitivity variable, used for the settings buttons and in the "mmoved" function
let mouseS = 300

class Slider {
    constructor(x, y, w, h, scenes, label, min, max, settingName, callback) {
        this.x = x
        this.y = y
        this.h = h
        this.w = Math.max(w, 350)
        this.name = settingName
        this.scenes = Array.isArray(scenes) ? scenes : [scenes]
        this.label = label
        this.min = min
        this.max = max
        this.sliding = false
        this.callback = callback
    }
    draw() {
        if (!this.scenes.includes(screen)) {
            return
        }
        let current = (settings[this.name] - this.min) / (this.max - this.min)

        // Outline
        ctx2D.beginPath()
        strokeWeight(2)
        stroke(0)
        fill(85)
        ctx2D.rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h)
        ctx2D.stroke()
        ctx2D.fill()

        // Slider bar
        let value = Math.round(settings[this.name])
        ctx2D.beginPath()
        fill(130)
        let x = this.x - (this.w - 10) / 2 + (this.w - 10) * current - 5
        ctx2D.fillRect(x, this.y - this.h / 2, 10, this.h)

        //Label
        fill(255, 255, 255)
        textSize(16)
        textAlign('center');
        text(`${this.label}: ${value}`, this.x, this.y + this.h / 8)
    }
    click() {
        if (!mouseDown || !this.scenes.includes(screen)) {
            return false
        }

        if (mouseX > this.x - this.w / 2 && mouseX < this.x + this.w / 2 && mouseY > this.y - this.h / 2 && mouseY < this.y + this.h / 2) {
            let current = (mouseX - this.x + this.w / 2) / this.w
            if (current < 0) current = 0
            if (current > 1) current = 1
            this.sliding = true
            settings[this.name] = current * (this.max - this.min) + this.min
            this.callback(current * (this.max - this.min) + this.min)
            this.draw()
        }
    }
    drag() {
        if (!this.sliding || !this.scenes.includes(screen)) {
            return false
        }

        let current = (mouseX - this.x + this.w / 2) / this.w
        if (current < 0) current = 0
        if (current > 1) current = 1
        settings[this.name] = current * (this.max - this.min) + this.min
        this.callback(current * (this.max - this.min) + this.min)
    }
    release() {
        this.sliding = false
    }

    static draw() {
        for (let slider of Slider.all) {
            slider.draw()
        }
    }
    static click() {
        for (let slider of Slider.all) {
            slider.click()
        }
    }
    static release() {
        for (let slider of Slider.all) {
            slider.release()
        }
    }
    static drag() {
        if (mouseDown) {
            for (let slider of Slider.all) {
                slider.drag()
            }
        }
    }
    static add(x, y, w, h, scenes, label, min, max, defaut, callback) {
        Slider.all.push(new Slider(x, y, w, h, scenes, label, min, max, defaut, callback))
    }
}
Slider.all = []
class Button {
    constructor(x, y, w, h, labels, scenes, callback, disabled, hoverText) {
        this.x = x
        this.y = y
        this.h = h
        this.w = w
        this.index = 0
        this.disabled = disabled || (() => false)
        this.hoverText = !hoverText || typeof hoverText === "string" ? (() => hoverText) : hoverText
        this.scenes = Array.isArray(scenes) ? scenes : [scenes]
        this.labels = Array.isArray(labels) ? labels : [labels]
        this.callback = callback
    }

    mouseIsOver() {
        return mouseX >= this.x - this.w / 2 && mouseX <= this.x + this.w / 2 && mouseY >= this.y - this.h / 2 && mouseY <= this.y + this.h / 2
    }
    draw() {
        if (!this.scenes.includes(screen)) {
            return
        }
        let hovering = this.mouseIsOver()
        let disabled = this.disabled()
        let hoverText = this.hoverText()

        // Outline
        ctx2D.beginPath()
        if (hovering && !disabled) {
            strokeWeight(7)
            stroke(255)
            cursor(HAND)
        } else {
            strokeWeight(3)
            stroke(0)
        }
        if (disabled) {
            fill(60)
        } else {
            fill(120)
        }
        ctx2D.rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h)
        ctx2D.stroke()
        ctx2D.fill()

        //Label
        fill(255)
        textSize(16)
        textAlign('center');
        text(this.labels[this.index], this.x, this.y + this.h / 8)

        if (hovering && hoverText) {
            hoverbox.innerText = hoverText
            hoverbox.classList.remove("hidden")
            if (mouseY < height / 2) {
                hoverbox.style.bottom = ""
                hoverbox.style.top = mouseY + 10 + "px"
            } else {
                hoverbox.style.top = ""
                hoverbox.style.bottom = height - mouseY + 10 + "px"
            }
            if (mouseX < width / 2) {
                hoverbox.style.right = ""
                hoverbox.style.left = mouseX + 10 + "px"
            } else {
                hoverbox.style.left = ""
                hoverbox.style.right = width - mouseX + 10 + "px"
            }
        }
    }

    click() {
        if (this.disabled() || !mouseDown || !this.scenes.includes(screen)) {
            return false
        }

        if (this.mouseIsOver()) {
            this.index = (this.index + 1) % this.labels.length
            this.callback(this.labels[this.index])
            return true
        }
    }

    static draw() {
        hoverbox.classList.add("hidden")
        for (let button of Button.all) {
            button.draw()
        }
    }

    static click() {
        for (let button of Button.all) {
            if (button.click()) {
                Button.draw()
                break
            }
        }
    }

    static add(x, y, w, h, labels, scenes, callback, disabled, hoverText) {
        Button.all.push(new Button(x, y, w, h, labels, scenes, callback, disabled, hoverText))
    }
}
Button.all = []

function initButtons() {
    Button.all = []
    Slider.all = []
    const nothing = () => false
    const always = () => true

    // Main menu buttons
    Button.add(width / 2, height / 2 - 20, 400, 40, "Singleplayer", "main menu", r => changeScene("loadsave menu"))
    Button.add(width / 2, height / 2 + 35, 400, 40, "Multiplayer", "main menu", nothing, always, "Multiplayer isn't ready yet.")
    Button.add(width / 2, height / 2 + 90, 400, 40, "Options", "main menu", r => changeScene("options"))
    Button.add(width / 2, height / 2 + 145, 400, 40, "Content", "main menu", nothing, always, "Mod Support is still being worked on.")//r => changeScene("content"))
  
    // Creation menu buttons
    Button.add(160, 135, 300, 40, ["World Type: Normal", "World Type: Superflat"], "creation menu", r => superflat = r === "World Type: Superflat")
    Button.add(160, 185, 300, 40, ["Trees: On", "Trees: Off"], "creation menu", r => trees = r === "Trees: On", function() {
        if (superflat) {
            this.index = 1
            trees = false
        }
        return superflat
    })
    Button.add(160, 235, 300, 40, ["Caves: On", "Caves: Off"], "creation menu", r => caves = r === "Caves: On", function() {
        if (superflat) {
            this.index = 1
            caves = false
        }
        return superflat
    })

    Button.add(160, 285, 300, 40, "Game Mode: Creative", "creation menu", nothing, always, "This will come with due time.")
    Button.add(160, 335, 300, 40, "Difficulty: Peaceful", "creation menu", nothing, always, "Soon(TM)")
    Button.add(width / 2, height - 90, width - 20, 40, "Create New World", "creation menu", r => {
        world = new World()
        world.id = Date.now()
        let name = boxCenterTop.value || "World";
        let number = "";
        while (true) {
            let match = false
            for (let id in worlds) {
                if (worlds[id].name === name + number) {
                    match = true
                    break
                }
            }
            if (match) {
                number = number ? number + 1 : 1
            } else {
                name = name + number
                break
            }
        }
        world.name = name.replace(/;/g, "\u037e")
        win.world = world
        world.loadChunks()
        world.chunkGenQueue.sort(sortChunks)
        changeScene("loading")
    })
    Button.add(width / 2, height - 40, width - 20, 40, "Cancel", "creation menu", r => changeScene(previousScreen))

    // Loadsave menu buttons
    const selected = () => !selectedWorld || !worlds[selectedWorld]
    const w4 = Math.min(width / 4 - 10, 220)
    const x4 = w4 / 2 + 5
    const w2 = Math.min(width / 2 - 10, 450)
    const x2 = w2 / 2 + 5
    const mid = width / 2
    Button.add(mid - 3 * x4, height - 30, w4, 40, "Edit", "loadsave menu", r => changeScene("editworld"), () => (selected() || !worlds[selectedWorld].edited))
    Button.add(mid - x4, height - 30, w4, 40, "Delete", "loadsave menu", r => {
        if (worlds[selectedWorld] && confirm(`Are you sure you want to delete ${worlds[selectedWorld].name}?`)) {
            deleteFromDB(selectedWorld)
            worldsDOM.removeChild(document.getElementById(selectedWorld))
            delete worlds[selectedWorld]
            selectedWorld = 0
        }
    }, () => (selected() || !worlds[selectedWorld].edited), "Delete the world forever.")
    Button.add(mid + x2, height - 30, w2, 40, "Cancel", "loadsave menu", r => changeScene("main menu"))
    Button.add(mid - x2, height - 75, w2, 40, "Play Selected World", "loadsave menu", r => {
        world = new World()
        win.world = world

        let code;
        if (!selectedWorld) {
            code = boxCenterTop.value
        } else {
            let data = worlds[selectedWorld]
            if (data) {
                code = data.code
                world.id = data.id
                world.edited = data.edited
            }
        }

        if (code) {
            try {
                world.loadSave(code)
                world.id = world.id || Date.now()
            } catch (e) {
                alert("Unable to load save")
                return
            }
            changeScene("loading")
        }
    }, () => !(!selectedWorld && boxCenterTop.value) && !worlds[selectedWorld])
    Button.add(mid + x2, height - 75, w2, 40, "Create New World", "loadsave menu", r => changeScene("creation menu"))

    Button.add(mid, height / 2, w2, 40, "Save", "editworld", r => {
        let w = worlds[selectedWorld]
        w.name = boxCenterTop.value.replace(/;/g, "\u037e")
        let split = w.code.split(";")
        split[0] = w.name
        w.code = split.join(";")
        saveToDB(w.id, w).then(success => {
            initWorldsMenu()
            changeScene("loadsave menu")
        }).catch(e => console.error(e))
    })
    Button.add(mid, height / 2 + 50, w2, 40, "Back", "editworld", r => changeScene(previousScreen))

    // Pause buttons
    Button.add(width / 2, 225, 300, 40, "Resume", "pause", play)
    Button.add(width / 2, 275, 300, 40, "Options", "pause", r => changeScene("options"))
    Button.add(width / 2, 325, 300, 40, "Save", "pause", save, nothing, () => `Save the world to your computer/browser. Doesn't work in incognito.\n\nLast saved ${timeString(Date.now() - world.edited)}.`)
    Button.add(width / 2, 375, 300, 40, "Exit Without Saving", "pause", r => {
        savebox.value = world.getSaveString()
        initWorldsMenu()
        changeScene("main menu")
    })

    // Options buttons
    Button.add(width / 2, 455, width / 3, 40, "Back", "options", r => changeScene(previousScreen))

    // Comingsoon menu buttons
    Button.add(width / 2, 395, width / 3, 40, "Back", "comingsoon menu", r => changeScene(previousScreen))

    // Multiplayer buttons
    Button.add(width / 2, 395, width / 3, 40, "¯\\_(ツ)_/¯", "multiplayer menu", r => changeScene("main menu"))

    // Settings Sliders
    Slider.add(width / 2, 245, width / 3, 40, "options", "Render Distance", 1, 32, "renderDistance", val => settings.renderDistance = Math.round(val))
    Slider.add(width / 2, 305, width / 3, 40, "options", "FOV", 30, 110, "fov", val => {
        p.FOV(val)
        if (world) {
            p.setDirection()
            world.render()
        }
    })
    Slider.add(width / 2, 365, width / 3, 40, "options", "Mouse Sensitivity", 50, 150, "mouseSense", val => settings.mouseSense = val)
}

function initTextures() {
    const textureSize = 256; // Atlas Size
    const tSize = 16; // Texture Size Itself
    const scale = 1 / tSize;
    const texturePixels = new Uint8Array(textureSize * textureSize * 4)
    textureMap = {}
    textureCoords = []

    // Texture Functions
    setPixel = function(textureNum, x, y, r, g, b, a) {
        let texX = textureNum & 15
        let texY = textureNum >> 4
        let offset = (texY * 16 + y) * 1024 + texX * 64 + x * 4
        texturePixels[offset] = r
        texturePixels[offset + 1] = g
        texturePixels[offset + 2] = b
        texturePixels[offset + 3] = a !== undefined ? a : 255
    }

    getPixels = function(str) {
        let colors = []
        let pixels = []
        let dCount = 0
        for (; str[4 + dCount] === "0"; dCount++) {}
        let ccount = parseInt(str.substr(4 + dCount, dCount + 1), 36)
        for (let i = 0; i < ccount; i++) {
            let num = parseInt(str.substr(5 + 2 * dCount + i * 7, 7), 36)
            colors.push([num >>> 24 & 255, num >>> 16 & 255, num >>> 8 & 255, num & 255])
        }

        for (let i = 5 + 2 * dCount + ccount * 7; i < str.length; i++) {
            let num = parseInt(str[i], 36)
            pixels.push(colors[num][0], colors[num][1], colors[num][2], colors[num][3])
        }

        return pixels
    };

    {
        // Specify the texture coords for each index
        const s = scale
        for (let i = 0; i < 256; i++) {
            let texX = i & 15
            let texY = i >> 4
            let offsetX = texX * s
            let offsetY = texY * s
            textureCoords.push(new Float32Array([offsetX, offsetY, offsetX + s, offsetY, offsetX + s, offsetY + s, offsetX, offsetY + s]))
        }

        // Set all of the textures into 1 big tiled texture
        let n = 0
        for (let i in textures) {
            if (typeof textures[i] === "function") {
                textures[i](n)
            } else if (typeof textures[i] === "string") {
                const pix = getPixels(textures[i])
                const pix_ln = pix.length;
                for (let j = 0; j < pix_ln; j += 4) {
                    setPixel(n, j >> 2 & 15, j >> 6, pix[j], pix[j + 1], pix[j + 2], pix[j + 3])
                }
            }

            textureMap[i] = n
            n++
        }

        //Set the hitbox texture to 1 pixel
        let arr = new Float32Array(192)
        for (let i = 0; i < 192; i += 2) {
            arr[i] = textureCoords[textureMap.hitbox][0] + 0.01
            arr[i + 1] = textureCoords[textureMap.hitbox][1] + 0.01
        }
        textureCoords[textureMap.hitbox] = arr
    }

    // Big texture with everything in it (To-do: Mipmapping Filter fix for clip transparents)
    tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureSize, textureSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, texturePixels)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(glUniforms.uSampler, 0)

    // Dirt texture for the background
    let dirtPixels = new Uint8Array(getPixels(textures.dirt))
    dirtTexture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, dirtTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, dirtPixels)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)

    genIcons()
}

function drawIcon(x, y, id) {
    id = id < 0xff ? (id | blockMode) : id
    x = x / (3 * height) - 0.1666 * width / height
    y = y / (3 * height) - 0.1666
    initModelView(null, x, y, 0, 0, 0); // I need to look into what initModelView does exactly

    let buffer = blockIcons[id]
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.vertexAttribPointer(glUniforms.aVertex, 3, gl.FLOAT, false, 24, 0)
    gl.vertexAttribPointer(glUniforms.aTexture, 2, gl.FLOAT, false, 24, 12)
    gl.vertexAttribPointer(glUniforms.aShadow, 1, gl.FLOAT, false, 24, 20)
    gl.drawElements(gl.TRIANGLES, blockIcons.lengths[id], gl.UNSIGNED_INT, 0)
}

function hotbar() {
    FOV(90)

    for (let i = 0; i < inventory.hotbar.length; i++) {
        if (inventory.hotbar[i]) {
            let x = width / 2 - inventory.hotbar.length / 2 * inventory.size + (i + 0.5) * inventory.size + 25
            let y = height - inventory.size
            drawIcon(x, y, inventory.hotbar[i])
        }
    }
}

function hud() {
    if (p.spectator) {
        return
    }

    hotbar()

    let s = inventory.size
    let x = width / 2 + 0.5
    let y = height / 2 + 0.5

    // Crosshair
    if (!p.spectator) {
        ctx2D.lineWidth = 1
        ctx2D.strokeStyle = "white"
        ctx2D.beginPath()
        ctx2D.moveTo(x - 10, y)
        ctx2D.lineTo(x + 10, y)
        ctx2D.moveTo(x, y - 10)
        ctx2D.lineTo(x, y + 10)
        ctx2D.stroke()
    }

    //Hotbar
    x = width / 2 - 9 / 2 * s + 0.5 + 25
    y = height - s * 1.5 + 0.5

    ctx2D.strokeStyle = "black"
    ctx2D.lineWidth = 2
    ctx2D.beginPath()
    ctx2D.moveTo(x, y)
    ctx2D.lineTo(x + s * 9, y)
    ctx2D.moveTo(x, y + s)
    ctx2D.lineTo(x + s * 9, y + s)
    for (let i = 0; i <= 9; i++) {
        ctx2D.moveTo(x + i * s, y)
        ctx2D.lineTo(x + i * s, y + s)
    }
    ctx2D.stroke()

    ctx2D.strokeStyle = "white"
    ctx2D.lineWidth = 2
    ctx2D.beginPath()

    ctx2D.strokeRect(width / 2 - 9 / 2 * s + inventory.hotbarSlot * s + 25, height - s * 1.5, s, s)

    let str = "Average Frame Time: " + analytics.displayedFrameTime + "ms\n" +
        "Worst Frame Time: " + analytics.displayedwFrameTime + "ms\n" +
        "Render Time: " + analytics.displayedRenderTime + "ms\n" +
        "Tick Time: " + analytics.displayedTickTime + "ms\n" +
        "Rendered Chunks: " + renderedChunks.toLocaleString() + " / " + world.loaded.length + "\n" +
        "Generated Chunks: " + generatedChunks.toLocaleString() + "\n" +
        "FPS: " + analytics.fps

    if (p.autoBreak) {
        text("Super breaker enabled", 5, height - 89, 12)
    }

    textAlign('right');
    text(p2.x + ", " + p2.y + ", " + p2.z, width - 10, 15, 0)
    textAlign('left');
    text(str, 5, height - 77, 12)
}

function drawInv() {
    let x = 0
    let y = 0
    let s = inventory.size
    const s2 = s / 2
    const perRow = 13

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
    ctx2D.fillStyle = "rgb(127, 127, 127)"
    ctx2D.fillRect(0, 0, canvas.width, canvas.height);
    FOV(90)

    // Draw the grid
    ctx2D.lineWidth = 1;
    ctx2D.strokeStyle = "black";
    ctx2D.beginPath()
    for (y = 0; y < 10; y++) {
        ctx2D.moveTo(50.5 - s2, 50.5 - s2 + y * s)
        ctx2D.lineTo(50.5 - s2 + s * perRow, 50.5 - s2 + y * s)
    }
    y--
    for (x = 0; x < perRow + 1; x++) {
        ctx2D.moveTo(50.5 - s2 + s * x, 50.5 - s2)
        ctx2D.lineTo(50.5 - s2 + s * x, 50.5 - s2 + y * s)
    }

    // Hotbar
    x = width / 2 - inventory.hotbar.length / 2 * s + 0.5 + 25
    y = height - s * 1.5 + 0.5
    ctx2D.moveTo(x, y)
    ctx2D.lineTo(x + s * 9, y)
    ctx2D.moveTo(x, y + s)
    ctx2D.lineTo(x + s * 9, y + s)
    for (let i = 0; i <= inventory.hotbar.length; i++) {
        ctx2D.moveTo(x + i * s, y)
        ctx2D.lineTo(x + i * s, y + s)
    }
    ctx2D.stroke()

    let overHot = (mouseX - x) / s | 0
    if (mouseX < x + 9 * s && mouseX > x && mouseY > y && mouseY < y + s) {
        x += s * overHot
        ctx2D.lineWidth = 2
        ctx2D.strokeStyle = "white"
        ctx2D.beginPath()
        ctx2D.strokeRect(x, y, s, s)
    }

    //Box highlight in inv
    let overInv = Math.round((mouseY - 50) / s) * perRow + Math.round((mouseX - 50) / s)
    if (overInv >= 0 && overInv < BLOCK_COUNT - 1 && mouseX < 50 - s2 + perRow * s && mouseX > 50 - s2) {
        x = overInv % perRow * s + 50 - s2
        y = (overInv / perRow | 0) * s + 50 - s2
        ctx2D.lineWidth = 2
        ctx2D.strokeStyle = "white"
        ctx2D.beginPath()
        ctx2D.strokeRect(x, y, s, s)
    }

    if (inventory.holding) {
        drawIcon(mouseX, mouseY, inventory.holding)
    }
    for (let i = 1; i < BLOCK_COUNT; i++) {
        x = (i - 1) % perRow * s + 50
        y = ((i - 1) / perRow | 0) * s + 50
        drawIcon(x, y, i)
    }

    hotbar()
    //hud()
    ctx2D.drawImage(gl.canvas, 0, 0)
}

function clickInv() {
    let s = inventory.size
    let s2 = s / 2
    let perRow = 13
    let over = Math.round((mouseY - 50) / s) * perRow + Math.round((mouseX - 50) / s)
    let x = width / 2 - 9 / 2 * s + 25
    let y = height - s * 1.5
    let overHot = (mouseX - x) / s | 0
    if (mouseX < x + 9 * s && mouseX > x && mouseY > y && mouseY < y + s) {
        let temp = inventory.hotbar[overHot]
        inventory.hotbar[overHot] = inventory.holding
        inventory.holding = temp
    } else if (over >= 0 && over < BLOCK_COUNT - 1 && mouseX < 50 - s2 + perRow * s && mouseX > 50 - s2) {
        inventory.holding = over + 1
    } else {
        inventory.holding = 0
    }

    drawScreens.inventory()
}

let unpauseDelay = 0

function mmoved(e) {
    let mouseS = settings.mouseSense / 30000
    p.rx -= e.movementY * mouseS
    p.ry += e.movementX * mouseS

    while (p.ry > Math.PI * 2) {
        p.ry -= Math.PI * 2
    }
    while (p.ry < 0) {
        p.ry += Math.PI * 2
    }
    if (p.rx > Math.PI / 2) {
        p.rx = Math.PI / 2
    }
    if (p.rx < -Math.PI / 2) {
        p.rx = -Math.PI / 2
    }
}

function trackMouse(e) {
    cursor("")
    mouseX = e.x
    mouseY = e.y
    drawScreens[screen]()
    Button.draw()
    Slider.draw()
    Slider.drag()
}
document.onmousemove = trackMouse
document.onpointerlockchange = function() {
    if (doc.pointerLockElement === canvas) {
        doc.onmousemove = mmoved
    } else {
        doc.onmousemove = trackMouse
        if (screen === "play" && !freezeFrame) {
            changeScene("pause")
            unpauseDelay = Date.now() + 1000
        }
    }
    for (let key in Key) {
        Key[key] = false
    }
}
canvas.onmousedown = function(e) {
    mouseX = e.x
    mouseY = e.y
    mouseDown = true
    let block, index
    switch (e.button) {
        case 0:
            Key.leftMouse = true
            break
        case 1:
            Key.middleMouse = true
            if (!hitBox.pos) break
            updateHUD = true
            block = world.getBlock(hitBox.pos[0], hitBox.pos[1], hitBox.pos[2]) & 0x3ff
            index = inventory.hotbar.indexOf(block)
            if (index >= 0) {
                inventory.hotbarSlot = index
            } else {
                inventory.hotbar[inventory.hotbarSlot] = block
            }
            break
        case 2:
            Key.rightMouse = true
            break
    }
    if (screen === "play") {
        if (doc.pointerLockElement !== canvas) {
            getPointer()
            p.lastBreak = Date.now()
        } else {
            place = false
            if (!e.button) {
                if (Key.control) {
                    place = true
                } else {
                    changeWorldBlock(0)
                }
            }
            holding = inventory.hotbar[inventory.hotbarSlot]
            if (e.button === 2 && holding) {
                place = true
            }
            if (place) {
                newWorldBlock()
            }
        }
    } else if (screen === "inventory") {
        clickInv()
    }

    Button.click()
    Slider.click()
}
canvas.onmouseup = function(e) {
    switch (e.button) {
        case 0:
            Key.leftMouse = false
            break
        case 1:
            Key.middleMouse = false
            break
        case 2:
            Key.rightMouse = false
            break
    }
    mouseDown = false
    Slider.release()
}
canvas.onkeydown = function(e) {
    let k = e.key.toLowerCase()
    if (k === " ") {
        e.preventDefault()
    }
    if (e.repeat || Key[k]) {
        return
    }
    Key[k] = true

    if (k === "t") {
        initTextures()
    }

    if (k === "enter") {
        blockMode = blockMode === CUBE ? SLAB : (blockMode === SLAB ? STAIR : CUBE)
        updateHUD = true
    }

    if (screen === "play") {
        if (k === "p") {
            releasePointer()
            changeScene("pause")
        }

        if (k === "b") {
            p.autoBreak = !p.autoBreak
            updateHUD = true
        }

        if (k === " " && !p.spectator) {
            if (Date.now() < p.lastJump + 400) {
                p.flying ^= true
            } else {
                p.lastJump = Date.now()
            }
        }

        if (k === "z") {
            p.FOV(10, 300)
        }

        if (k === "shift" && !p.flying) {
            p.sneaking = true
            if (p.sprinting) {
                p.FOV(settings.fov, 100)
            }
            p.sprinting = false
            p.speed = 0.03
            p.bottomH = 1.32
        }

        if (k === "l") {
            p.spectator = !p.spectator
            p.flying = true
            p.onGround = false
            updateHUD = true
        }

        if (k === "e") {
            changeScene("inventory")
            releasePointer()
        }

        if (k === ";") {
            releasePointer()
            freezeFrame = true
        }

        if (Number(k)) {
            inventory.hotbarSlot = Number(k) - 1
            holding = inventory.hotbar[inventory.hotbarSlot]
            updateHUD = true
        }
    } else if (screen === "pause") {
        if (k === "p") {
            play()
        }
    } else if (screen === "inventory") {
        if (k === "e") {
            play()
        }
        if (k === "enter") {
            drawScreens.inventory()
        }
    }
}
canvas.onkeyup = function(e) {
    let k = e.key.toLowerCase()
    Key[k] = false
    if (k === "escape" && (screen === "pause" || screen === "inventory" || screen === "options" && previousScreen === "pause") && Date.now() > unpauseDelay) {
        play()
    }
    if (screen === "play") {
        if (k === "z") {
            p.FOV(settings.fov, 300)
        }

        if (k === "shift" && p.sneaking) {
            p.sneaking = false
            p.speed = 0.075
            p.bottomH = 1.62
            // p.y += 0.3
        }
    }
}
canvas.onblur = function() {
    for (let key in Key) {
        Key[key] = false
    }
    mouseDown = false
    Slider.release()
}
canvas.oncontextmenu = function(e) {
    e.preventDefault()
}
window.onbeforeunload = e => {
    if (screen === "play" && Key.control) {
        releasePointer()
        e.preventDefault()
        e.returnValue = "Q is the sprint button; Ctrl + W closes the page."
        return true
    }
}

canvas.onwheel = e => {
    e.preventDefault()
    e.stopPropagation()
    if (e.deltaY > 0) {
        inventory.hotbarSlot++
    } else if (e.deltaY < 0) {
        inventory.hotbarSlot--
    }
    if (inventory.hotbarSlot > 8) {
        inventory.hotbarSlot = 0
    } else if (inventory.hotbarSlot < 0) {
        inventory.hotbarSlot = 8
    }

    updateHUD = true
    holding = inventory.hotbar[inventory.hotbarSlot]
}

window.onresize = e => {
    width = window.innerWidth
    height = window.innerHeight
    canvas.height = height
    canvas.width = width
    gl.canvas.height = height
    gl.canvas.width = width
    gl.viewport(0, 0, width, height)
    initButtons()
    initBackgrounds()
    inventory.size = 40 * Math.min(width, height) / 600
    genIcons()
    use3d()
    p.FOV(p.currentFov + 0.0001)
    if (screen === "play") {
        play();
    } else {
        drawScreens[screen]()
        Button.draw()
        Slider.draw()
    }
}

function use2d() {
    gl.disableVertexAttribArray(glUniforms.aTexture)
    gl.disableVertexAttribArray(glUniforms.aShadow)
    gl.disableVertexAttribArray(glUniforms.aVertex)
    gl.useProgram(programs[1])

    gl.enableVertexAttribArray(glUniforms.aVertex2)
    gl.enableVertexAttribArray(glUniforms.aTexture2)
    gl.enableVertexAttribArray(glUniforms.aShadow2)
}

function use3d() {
    gl.disableVertexAttribArray(glUniforms.aTexture2)
    gl.disableVertexAttribArray(glUniforms.aShadow2)
    gl.disableVertexAttribArray(glUniforms.aVertex2)
    gl.useProgram(programs[0])

    gl.enableVertexAttribArray(glUniforms.aVertex)
    gl.enableVertexAttribArray(glUniforms.aTexture)
    gl.enableVertexAttribArray(glUniforms.aShadow)
}

let maxLoad = 1 // WTF does this do?
function startLoad() {
    // Runs when the loading screen is opened; cache the player's position
    p2.x = p.x
    p2.y = p.y
    p2.z = p.z
    maxLoad = world.loadFrom.length + 9
}

function initWebgl() {
    if (!win.gl) {
        const canv = document.createElement('canvas')
        canv.width = ctx2D.canvas.width
        canv.height = ctx2D.canvas.height
        canv.style = `position: absolute;
                    z-index: -1;
                    top: 0px;
                    left: 0px;`; // Merged to prevent DOM Restyling Events (1 vs 4)
      
        renderer = new WebGL2Renderer(canv);
        gl = renderer.gl;
      
        if (!gl) {
          throw "WebGL2 API not Supported"; // Fallback
        } else {
          gl.viewport(0, 0, canv.width, canv.height);
          gl.enable(gl.DEPTH_TEST);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          win.gl = gl
        }
    } else {
        gl = win.gl
    }

    if (!document.body.contains(gl.canvas)) {
        document.body.append(gl.canvas)
    }

    modelView = new Float32Array(16)
    glUniforms = {}
  
    // Create Program3D
    const vertShader3 = renderer.createVertexShader(vertexShaderSrc3D);
    const fragShader3 = renderer.createFragmentShader(fragmentShaderSrc3D);

    programs[0] = renderer.createProgram(vertShader3, fragShader3);

    // Create Program2D
    const vertShader2 = renderer.createVertexShader(vertexShaderSrc2D);
    const fragShader2 = renderer.createFragmentShader(fragmentShaderSrc2D);
    programs[1] = renderer.createProgram(vertShader2, fragShader2);

    // Uniform Setup
    renderer.setProgram(programs[1]); // 2D Uniforms
  
    glUniforms.uSampler2 = renderer.getUniform("uSampler");
    glUniforms.aTexture2 = renderer.getAttrib("aTexture");
    glUniforms.aVertex2 = renderer.getAttrib("aVertex");
    glUniforms.aShadow2 = renderer.getAttrib("aShadow");
  
    renderer.setProgram(programs[0]); // 3D Uniforms

    glUniforms.uFogColor = renderer.getUniform("uFogColor");
    glUniforms.uSampler = renderer.getUniform("uSampler");
    glUniforms.uPos = renderer.getUniform("uPos");
    glUniforms.uDist = renderer.getUniform("uDist");
    glUniforms.aShadow = renderer.getAttrib("aShadow");
    glUniforms.aLightValue = renderer.getAttrib("aLightValue"); // Unused Value that will be the light level of the block in question, I will try to base the code off of aShadow
    glUniforms.uSkyLight = renderer.getUniform("uSkyLight"); // Unused value to input the current skylight level (for lighting engine)
    glUniforms.aTexture = renderer.getAttrib("aTexture");
    glUniforms.aVertex = renderer.getAttrib("aVertex");
  
    gl.uniform1f(glUniforms.uDist, 1000); // Magical Frustrum Culling Thing that I haven't bothered to look at
    gl.uniform1f(glUniforms.uSkyLight, currentSkyLightLevel); // Current Sky Light Level, as a float because I am
    gl.uniform3f(glUniforms.uFogColor, sky[0], sky[1], sky[2]); // Magical Fog Uniform!
  
    //Send the block textures to the GPU
    initTextures()
    initShapes()
  
    // These buffers are only used for drawing the main menu blocks (Removing them crashes mid-game?)
    sideEdgeBuffers = {}
    for (let side in shapes.cube.verts) {
        let edgeBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shapes.cube.verts[side][0]), gl.STATIC_DRAW)
        sideEdgeBuffers[side] = edgeBuffer
    }

    texCoordsBuffers = []
    for (let t in textureCoords) {
        let buff = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buff)
        gl.bufferData(gl.ARRAY_BUFFER, textureCoords[t], gl.STATIC_DRAW)
        texCoordsBuffers.push(buff)
    }

    //Bind the Vertex Array Object (VAO) that will be used to draw everything
    indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexOrder, gl.STATIC_DRAW);

    // Cull Back Faces
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.lineWidth(2)
    blockOutlines = false
    gl.enable(gl.POLYGON_OFFSET_FILL)
    gl.polygonOffset(1, 1)
    gl.clearColor(sky[0], sky[1], sky[2], 1.0)
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
}

function initBackgrounds() {
    let pixels = new Uint8Array(width * height * 4)
    const w = width * 4;

    // Dirt background
    use2d()
    const aspect = width / height; // To-do: Replace this with an optimal algorithm!
    const stack = height / 96
    const bright = 0.4
    if (dirtBuffer) {
        gl.deleteBuffer(dirtBuffer)
    }

    dirtBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, dirtBuffer)

    let bgCoords = new Float32Array([
        -1, -1, 0, stack, bright,
        1, -1, stack * aspect, stack, bright,
        1, 1, stack * aspect, 0, bright,
        -1, 1, 0, 0, bright
    ])

    gl.bufferData(gl.ARRAY_BUFFER, bgCoords, gl.STATIC_DRAW)
    gl.uniform1i(glUniforms.uSampler2, 1)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
    gl.vertexAttribPointer(glUniforms.aVertex2, 2, gl.FLOAT, false, 20, 0)
    gl.vertexAttribPointer(glUniforms.aTexture2, 2, gl.FLOAT, false, 20, 8)
    gl.vertexAttribPointer(glUniforms.aShadow2, 1, gl.FLOAT, false, 20, 16)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    dirtbg = ctx2D.createImageData(width, height)
    dirtbg.data.set(pixels)
}

function initPlayer() {
    p = new Camera()
    p.speed = 0.075
    p.velocity = new Vector3(0, 0, 0)
    p.pos = new Float32Array(3)
    p.sprintSpeed = 1.5
    p.flySpeed = 2.5
    p.x = 8
    p.y = superflat ? 6 : (Math.round(noise(8 * generator.smooth, 8 * generator.smooth) * generator.height) + 2 + generator.extra)
    p.z = 8
    p.previousX = 8
    p.previousY = 70
    p.previousZ = 8
    p.w = 3 / 8
    p.bottomH = 1.62
    p.topH = 0.18
    p.onGround = false
    p.jumpSpeed = 0.3
    p.sprinting = false
    p.maxYVelocity = 1.5
    p.gravityStength = -0.032
    p.lastUpdate = win.performance.now()
    p.lastBreak = Date.now()
    p.lastPlace = Date.now()
    p.lastJump = Date.now()
    p.autoBreak = false
    p.flying = false
    p.sneaking = false
    p.spectator = false

    win.player = p
    win.p2 = p2
}

function initWorldsMenu() {
    while (worldsDOM.firstChild) {
        worldsDOM.removeChild(worldsDOM.firstChild)
    }
    selectedWorld = 0
    savebox.value = ""

    const deselect = () => {
        let elem = document.getElementsByClassName("selected")
        if (elem && elem[0]) {
            elem[0].classList.remove("selected")
        }
    }

    function addWorld(name, version, size, id, edited) {
        let div = doc.createElement("div")
        div.className = "world"
        div.onclick = e => {
            deselect()
            div.classList.add("selected")
            selectedWorld = id
        }
        let br = "<br>"
        div.id = id
        div.innerHTML = `<strong>${name}</strong>${br}`;
        if (edited) {
            let str = (new Date(edited).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }))
            div.innerHTML += `${str}${br}`
        }
        div.innerHTML += `${version}${br}`
        div.innerHTML += `${size.toLocaleString()} bytes used`

        worldsDOM.appendChild(div)
    }

    worlds = {}
    loadFromDB().then(res => {
        if (res && res.length) {
            let index = res.findIndex(obj => obj.id === "settings")
            if (index >= 0) {
                Object.assign(settings, res[index].data) // Stored data overrides any hardcoded settings
                p.FOV(settings.fov)
                res.splice(index, 1)
            }
        }

        if (res && res.length) {
            res = res.map(d => d.data).filter(d => d && d.code).sort((a, b) => b.edited - a.edited)
            for (let data of res) {
                addWorld(data.name, data.version, (data.code.length + 60), data.id, data.edited)
                worlds[data.id] = data
            }
        }
        worlds.onclick = Button.draw
        savebox.onkeyup = Button.draw
    }).catch(e => console.error(e))

    superflat = false
    trees = true
    caves = true
}

function initEverything() {
    console.log("Initializing world.")

    worldSeed = Math.random() * 2000000000 | 0
    seedHash(worldSeed)
    caveNoise = openSimplexNoise(worldSeed)
    noiseSeed(worldSeed)

    generatedChunks = 0

    initPlayer()
    initWebgl()

    initBackgrounds()

    drawScreens[screen]()
    Button.draw()
    Slider.draw()

    p.FOV(settings.fov)
    initWorldsMenu()
    initButtons()
}

// Define all the scene draw functions
(function() {
    function title() {
        const w2 = width / 2;
        const font = "VT323,monospace";
        strokeWeight(1)
        textAlign('center');

        ctx2D.font = "bold 120px " + font
        fill(30)
        text("Blockverse 2", w2, 158)
        fill(40)
        text("Blockverse 2", w2, 155)
        ctx2D.font = "bold 121px " + font
        fill(50)
        text("Blockverse 2", w2, 152)
        fill(70)
        text("Blockverse 2", w2, 150)
        fill(90)
        ctx2D.font = "bold 122px " + font
        text("Blockverse 2", w2, 148)
        fill(110)
        text("Blockverse 2", w2, 145)
    }

    const clear = () => ctx2D.clearRect(0, 0, canvas.width, canvas.height)
    const dirt = () => ctx2D.putImageData(dirtbg, 0, 0)

    drawScreens["main menu"] = () => {
        ctx2D.putImageData(dirtbg, 0, 0);
        title();
        fill(220);
        ctx2D.font = "20px VT323"
        textAlign('left');
        text("Blockverse " + version, width - (width - 2), height - 2);
    }

    drawScreens.play = () => {
        controls()
        runGravity()
        resolveContactsAndUpdatePosition()

        if (updateHUD) {
            clear()
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
            hud()
            ctx2D.drawImage(gl.canvas, 0, 0)
            updateHUD = false
            freezeFrame = false

            gl.clearColor(sky[0], sky[1], sky[2], 1.0)
        }
        defineWorld()
    }

    drawScreens.loading = () => {
        // This is really stupid, but it basically works by teleporting the player around to each chunk I'd like to load.
        // If chunks loaded from a save aren't generated, they're deleted from the save, so this loads them all.

        let sub = maxLoad - world.loadFrom.length - 9
        let standing = true
        if (world.loadFrom.length) {
            let load = world.loadFrom[0]
            p.x = load.x * 16
            p.y = load.y * 16
            p.z = load.z * 16
            standing = false
        } else {
            p.x = p2.x
            p.y = p2.y
            p.z = p2.z

            let cx = p.x >> 4
            let cz = p.z >> 4

            for (let x = cx - 1; x <= cx + 1; x++) {
                for (let z = cz - 1; z <= cz + 1; z++) {
                    if (!world.chunks[x] || !world.chunks[x][z] || !world.chunks[x][z].buffer) {
                        standing = false
                    } else {
                        sub++
                    }
                }
            }
        }

        if (standing) {
            play()
            return
        }

        world.tick()

        let progress = Math.round(100 * sub / maxLoad)
        dirt()
        fill(255)
        textSize(30)
        textAlign('center');
        text(`Loading... (${progress}%)`, width / 2, height / 2)
    }

    drawScreens.inventory = drawInv

    drawScreens.pause = () => {
        strokeWeight(1)
        clear()
        ctx2D.drawImage(gl.canvas, 0, 0)

        fill(0, 0, 0, 0.5);
        rect(0, 0, canvas.width, canvas.height)
        textSize(60)
        fill(0, 0, 0)
        textAlign('center');
        fill(255);
        text("Paused", width / 2, 60)
    }

    drawScreens.options = () => {
        clear()
    }

    drawScreens["creation menu"] = () => {
        dirt()
        textAlign('right');
        textSize(20)
        fill(255)
        text("World Creator", width - 10, 20)
    }

    drawScreens["loadsave menu"] = () => {
        dirt()
        textAlign('center');
        textSize(20)
        fill(255)
        text("Select World", width / 2, 20)
    }

    drawScreens.editworld = dirt
})()

// Give the font time to load and redraw the homescreen (To-do: FontFace API)
setTimeout(e => {
    drawScreens[screen]()
    Button.draw()
    Slider.draw()
}, 100)

let debugMenu = false;

function gameLoop() {
    let frameStart = win.performance.now()
    if (!gl) {
        initEverything()
        releasePointer()
    }

    if (screen === "play" || screen === "loading") {
        drawScreens[screen]()
    }

    if (Date.now() - analytics.lastUpdate > 500 && analytics.frames) {
        analytics.displayedTickTime = (analytics.totalTickTime / analytics.frames).toFixed(1)
        analytics.displayedRenderTime = (analytics.totalRenderTime / analytics.frames).toFixed(1)
        analytics.displayedFrameTime = (analytics.totalFrameTime / analytics.frames).toFixed(1)
        analytics.fps = Math.round(analytics.frames * 1000 / (Date.now() - analytics.lastUpdate))
        analytics.displayedwFrameTime = analytics.worstFrameTime.toFixed(1)
        analytics.frames = 0
        analytics.totalRenderTime = 0
        analytics.totalTickTime = 0
        analytics.totalFrameTime = 0
        analytics.worstFrameTime = 0
        analytics.lastUpdate = Date.now()
        updateHUD = true
    }

    analytics.frames++
    analytics.totalFrameTime += win.performance.now() - frameStart
    analytics.worstFrameTime = Math.max(win.performance.now() - frameStart, analytics.worstFrameTime)
    win.raf = requestAnimationFrame(gameLoop)
}

if (window.parent.raf) {
    window.cancelAnimationFrame(window.parent.raf)
    console.log("Canceled", window.parent.raf)
} // WTF does this do?

gameLoop();