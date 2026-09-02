const len = 8;

export default function generate() {
    let ans = "";
    const subset = "123456789qwertyuiopasdfghjklzxcvbnm";
    
    for (let i = 0; i < len; ++i) {
        ans += subset[Math.floor(Math.random() * subset.length)];
    }
    return ans;
}